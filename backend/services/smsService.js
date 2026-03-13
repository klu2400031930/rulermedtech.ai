const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

class SMSService {
    constructor() {
        this.provider = '';
        this.twilioAccountSid = '';
        this.twilioAuthToken = '';
        this.twilioFrom = '';
        this.twilioMessagingServiceSid = '';
        this.envLoadError = null;
        this.envPath = path.join(__dirname, '..', '.env');
        this.envExists = false;
        this.twilioClient = null;
        this.emergencyContact = process.env.EMERGENCY_CONTACT || '8019890145';
        this.sentMessages = [];
        this.io = null;

        this.reloadConfig();
    }

    setSocketIO(io) {
        this.io = io;
    }

    reloadConfig() {
        this.envExists = fs.existsSync(this.envPath);
        const result = dotenv.config({ path: this.envPath, override: true });
        this.envLoadError = result.error ? result.error.message : null;

        this.provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
        this.twilioAccountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
        this.twilioAuthToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
        this.twilioFrom = (process.env.TWILIO_FROM || '').trim();
        this.twilioMessagingServiceSid = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
    }

    hasAutoSMSGateway() {
        return this.resolveProvider().provider !== 'none';
    }

    getTwilioMissingFields() {
        const missing = [];
        if (!this.twilioAccountSid) missing.push('TWILIO_ACCOUNT_SID');
        if (!this.twilioAuthToken) missing.push('TWILIO_AUTH_TOKEN');
        if (!this.twilioFrom && !this.twilioMessagingServiceSid) {
            missing.push('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID');
        }
        return missing;
    }

    resolveProvider() {
        this.reloadConfig();
        const isTwilioReady = this.isTwilioConfigured();
        const activeProvider = this.provider || 'twilio';

        if (activeProvider !== 'twilio') {
            return { provider: 'none', reason: 'SMS_PROVIDER_INVALID' };
        }

        return {
            provider: isTwilioReady ? 'twilio' : 'none',
            reason: isTwilioReady ? null : 'TWILIO_NOT_CONFIGURED'
        };
    }

    isTwilioConfigured() {
        return this.getTwilioMissingFields().length === 0;
    }

    getTwilioClient() {
        if (!this.twilioClient) {
            const twilio = require('twilio');
            this.twilioClient = twilio(this.twilioAccountSid, this.twilioAuthToken);
        }
        return this.twilioClient;
    }

    formatToE164(rawNumber) {
        const digits = (rawNumber || '').replace(/[^0-9]/g, '');
        if (!digits) return rawNumber;
        if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
        if (digits.length === 10) return `+91${digits}`;
        if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`;
        return `+${digits}`;
    }

    async sendAutomaticSMS(to, message, type = 'emergency') {
        this.reloadConfig();
        const cleanNumber = to.replace(/[^0-9]/g, '').replace(/^91/, '');
        const { provider, reason } = this.resolveProvider();

        if (provider === 'none') {
            const missing = reason === 'TWILIO_NOT_CONFIGURED'
                ? this.getTwilioMissingFields()
                : [];
            const envHint = this.envLoadError
                ? ` (env error: ${this.envLoadError})`
                : !this.envExists
                    ? ` (env missing: ${this.envPath})`
                    : '';
            const errorMessage = reason === 'SMS_PROVIDER_INVALID'
                ? `Unknown SMS provider "${this.provider}". Use "twilio".`
                : reason === 'TWILIO_NOT_CONFIGURED'
                    ? `Twilio SMS is selected but not configured${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${envHint}`
                    : 'Automatic SMS gateway is not configured';
            const error = new Error(errorMessage);
            error.code = 'SMS_GATEWAY_NOT_CONFIGURED';
            throw error;
        }

        try {
            const twilioClient = this.getTwilioClient();
            const payload = {
                to: this.formatToE164(to),
                body: message.substring(0, 160)
            };

            if (this.twilioMessagingServiceSid) {
                payload.messagingServiceSid = this.twilioMessagingServiceSid;
            } else {
                payload.from = this.twilioFrom;
            }

            const response = await twilioClient.messages.create(payload);

            const smsRecord = {
                to: cleanNumber,
                message,
                type,
                timestamp: new Date().toISOString(),
                status: response.status || 'sms_delivered',
                provider: 'twilio',
                sid: response.sid
            };

            this.sentMessages.push(smsRecord);
            console.log(`Twilio SMS delivered to ${cleanNumber}`);
            return smsRecord;
        } catch (err) {
            if (err.response?.data) {
                console.error('SMS provider error response:', err.response.data);
            }
            const error = new Error(err.message || 'Automatic SMS delivery failed');
            error.code = err.code || 'SMS_DELIVERY_FAILED';
            throw error;
        }
    }

    getProviderStatus() {
        const { provider, reason } = this.resolveProvider();
        return {
            provider,
            reason,
            envLoadError: this.envLoadError,
            envPath: this.envPath,
            envExists: this.envExists,
            twilio: {
                configured: this.isTwilioConfigured(),
                hasAccountSid: Boolean(this.twilioAccountSid),
                hasAuthToken: Boolean(this.twilioAuthToken),
                hasFrom: Boolean(this.twilioFrom),
                hasMessagingServiceSid: Boolean(this.twilioMessagingServiceSid),
                missing: this.getTwilioMissingFields()
            }
        };
    }

    async sendSMS(to, message, type = 'emergency') {
        const cleanNumber = to.replace(/[^0-9]/g, '').replace(/^91/, '');

        const smsRecord = {
            to: cleanNumber,
            message,
            type,
            timestamp: new Date().toISOString(),
            status: 'sent',
            provider: 'in-app'
        };

        if (this.io) {
            this.io.emit('sms:notification', {
                to: cleanNumber,
                message,
                type,
                timestamp: smsRecord.timestamp,
                title: type === 'emergency'
                    ? 'EMERGENCY ALERT'
                    : type === 'hospital'
                        ? 'HOSPITAL ALERT'
                        : 'DOCTOR ALERT'
            });
            console.log(`In-app notification sent (${type})`);
        }

        if (this.hasAutoSMSGateway()) {
            try {
                const delivered = await this.sendAutomaticSMS(cleanNumber, message, type);
                return delivered;
            } catch {
                // Keep in-app notification behavior for existing flows.
            }
        }

        console.log(`\nSMS ALERT [${type.toUpperCase()}]`);
        console.log(`TO: ${cleanNumber}`);
        message.split('\n').forEach(line => console.log(line));
        console.log('');

        this.sentMessages.push(smsRecord);
        return smsRecord;
    }

    async sendEmergencyAlerts(emergencyData) {
        const { patientName, hospitalName, doctorName, ambulanceVehicle, estimatedArrival, diagnosis, patientLat, patientLng } = emergencyData;
        const results = [];

        const lat = patientLat || 17.3850;
        const lng = patientLng || 78.4867;
        const mapsLink = `https://maps.google.com/maps?q=${lat},${lng}`;
        const riskPercent = Math.round((diagnosis?.riskScore || diagnosis?.risk_score || 0.9) * 100);

        const msg1 = [
            `EMERGENCY: ${patientName}`,
            `Condition: ${diagnosis?.prediction || 'Critical'} | Risk: ${riskPercent}%`,
            `Location: ${mapsLink}`,
            `Hospital: ${hospitalName} | Doctor: ${doctorName}`,
            `Ambulance: ${ambulanceVehicle || 'Dispatched'} | ETA: ${estimatedArrival}min`,
            `Bed: ${emergencyData.bedType || 'ICU'} Reserved`
        ].join('\n');
        results.push(await this.sendSMS(this.emergencyContact, msg1, 'emergency'));

        await new Promise(r => setTimeout(r, 1000));

        const msg2 = [
            `INCOMING PATIENT: ${patientName}`,
            `Condition: ${diagnosis?.prediction} | Risk: ${riskPercent}%`,
            `ETA: ${estimatedArrival}min | Prepare ${emergencyData.bedType || 'ICU'} bed`,
            `Patient Location: ${mapsLink}`
        ].join('\n');
        results.push(await this.sendSMS(this.emergencyContact, msg2, 'hospital'));

        await new Promise(r => setTimeout(r, 1000));

        const msg3 = [
            `NEW CASE: ${patientName}`,
            `${diagnosis?.prediction} | Risk: ${riskPercent}%`,
            `Prepare for arrival. ETA: ${estimatedArrival}min`,
            `Location: ${mapsLink}`
        ].join('\n');
        results.push(await this.sendSMS(this.emergencyContact, msg3, 'doctor'));

        return results;
    }

    async sendConsultationSMS({
        to,
        doctorName,
        hospitalName,
        meetingTime,
        meetingLink,
        bookingId,
        statusLabel = 'Consultation update'
    }) {
        if (!to) {
            const error = new Error('Recipient phone is required');
            error.code = 'SMS_RECIPIENT_MISSING';
            throw error;
        }

        const message = [
            statusLabel,
            bookingId ? `Booking: ${bookingId}` : null,
            doctorName ? `Doctor: ${doctorName}` : null,
            hospitalName ? `Hospital: ${hospitalName}` : null,
            meetingTime ? `Time: ${new Date(meetingTime).toLocaleString()}` : null,
            meetingLink ? `Link: ${meetingLink}` : null
        ].filter(Boolean).join('\n');

        return this.sendSMS(to, message, 'consultation');
    }

    getRecentMessages(limit = 10) {
        return this.sentMessages.slice(-limit);
    }
}

module.exports = new SMSService();
