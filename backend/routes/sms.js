const express = require('express');
const { protect } = require('../middleware/auth');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

const router = express.Router();

function buildEmergencyMessage({ patientName, patientLocation, diagnosis }) {
    const lat = patientLocation?.lat || 17.3850;
    const lng = patientLocation?.lng || 78.4867;
    const mapsLink = `https://maps.google.com/maps?q=${lat},${lng}`;
    const triage = diagnosis?.risk_level || diagnosis?.riskLevel || 'Urgent';
    const hasExplicitRisk = diagnosis?.risk_score != null || diagnosis?.riskScore != null;
    const riskScore = hasExplicitRisk
        ? (diagnosis?.risk_score ?? diagnosis?.riskScore ?? 0)
        : triage === 'Emergency'
            ? 1
            : triage === 'Urgent'
                ? 0.7
                : 0.3;
    const riskPercent = Math.round(riskScore * 100);
    const symptoms = Array.isArray(diagnosis?.symptoms) && diagnosis.symptoms.length > 0
        ? diagnosis.symptoms.join(', ')
        : null;

    return [
        'EMERGENCY ALERT',
        `Patient: ${patientName || 'Patient'}`,
        `Condition: ${diagnosis?.prediction || 'Critical'} | Risk: ${riskPercent}%`,
        `Triage: ${triage}`,
        `Location: ${mapsLink}`,
        symptoms ? `Symptoms: ${symptoms}` : null,
        `Time: ${new Date().toLocaleString()}`,
        'Sent via MedAI Rural Health'
    ].filter(Boolean).join('\n');
}

// @route POST /api/sms/send-emergency
router.post('/send-emergency', protect, async (req, res) => {
    const { patientLocation, diagnosis } = req.body;
    const payload = {
        patientName: req.user.name,
        patientLocation,
        diagnosis
    };
    const message = buildEmergencyMessage(payload);

    const [smsResult, emailResult] = await Promise.allSettled([
        smsService.sendAutomaticSMS(smsService.emergencyContact, message, 'emergency'),
        emailService.sendEmergencyEmail({ ...payload, messageText: message })
    ]);

    const channels = {
        sms: smsResult.status === 'fulfilled'
            ? {
                success: true,
                to: smsResult.value.to,
                provider: smsResult.value.provider,
                status: smsResult.value.status
            }
            : {
                success: false,
                code: smsResult.reason?.code || 'SMS_DELIVERY_FAILED',
                message: smsResult.reason?.message || 'SMS delivery failed'
            },
        email: emailResult.status === 'fulfilled'
            ? {
                success: true,
                to: emailResult.value.to,
                provider: emailResult.value.provider,
                status: emailResult.value.status
            }
            : {
                success: false,
                code: emailResult.reason?.code || 'EMAIL_DELIVERY_FAILED',
                message: emailResult.reason?.message || 'Email delivery failed'
            }
    };

    if (channels.sms.success && channels.email.success) {
        return res.json({
            success: true,
            message,
            channels
        });
    }

    if (channels.sms.success || channels.email.success) {
        return res.status(207).json({
            success: false,
            code: 'PARTIAL_DELIVERY',
            message: 'Only some notification channels were delivered',
            channels
        });
    }

    console.error('Emergency notifications failed:', channels);
    return res.status(502).json({
        success: false,
        code: 'NOTIFICATION_DELIVERY_FAILED',
        message: 'SMS and email delivery both failed',
        channels
    });
});

// @route GET /api/sms/status
router.get('/status', protect, (req, res) => {
    res.json(smsService.getProviderStatus());
});

module.exports = router;
