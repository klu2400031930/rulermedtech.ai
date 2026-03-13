class EmailService {
    constructor() {
        this.alertEmail = process.env.ALERT_EMAIL || 'allaripilla8968@gmail.com';
        this.smtpHost = process.env.SMTP_HOST || '';
        this.smtpPort = Number(process.env.SMTP_PORT || 587);
        this.smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
        this.smtpUser = process.env.SMTP_USER || '';
        this.smtpPass = process.env.SMTP_PASS || '';
        this.smtpFrom = process.env.SMTP_FROM || this.smtpUser || 'alerts@medai.local';
    }

    hasEmailGateway() {
        return Boolean(this.smtpHost && this.smtpUser && this.smtpPass);
    }

    getMailer() {
        try {
            // eslint-disable-next-line global-require
            const nodemailer = require('nodemailer');
            return nodemailer.createTransport({
                host: this.smtpHost,
                port: this.smtpPort,
                secure: this.smtpSecure,
                auth: {
                    user: this.smtpUser,
                    pass: this.smtpPass
                }
            });
        } catch (error) {
            error.code = 'EMAIL_MODULE_MISSING';
            throw error;
        }
    }

    async sendMail({ to, subject, text, html }) {
        if (!this.hasEmailGateway()) {
            const error = new Error('Email gateway is not configured');
            error.code = 'EMAIL_GATEWAY_NOT_CONFIGURED';
            throw error;
        }

        const transporter = this.getMailer();
        const info = await transporter.sendMail({
            from: this.smtpFrom,
            to,
            subject,
            text,
            html
        });

        return {
            to,
            subject,
            provider: 'smtp',
            status: 'email_delivered',
            messageId: info.messageId
        };
    }

    async sendEmergencyEmail({ patientName, patientLocation, diagnosis, messageText }) {
        if (!this.hasEmailGateway()) {
            const error = new Error('Email gateway is not configured');
            error.code = 'EMAIL_GATEWAY_NOT_CONFIGURED';
            throw error;
        }

        const transporter = this.getMailer();
        const lat = patientLocation?.lat || 17.3850;
        const lng = patientLocation?.lng || 78.4867;
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
        const mapsLink = `https://maps.google.com/maps?q=${lat},${lng}`;

        const subject = `Emergency Alert: ${patientName || 'Patient'} - ${diagnosis?.prediction || 'Critical'}`;
        const text = messageText || [
            'EMERGENCY ALERT',
            `Patient: ${patientName || 'Patient'}`,
            `Condition: ${diagnosis?.prediction || 'Critical'} | Risk: ${riskPercent}%`,
            `Triage: ${triage}`,
            `Location: ${mapsLink}`,
            symptoms ? `Symptoms: ${symptoms}` : null,
            `Time: ${new Date().toLocaleString()}`,
            'Sent via MedAI Rural Health'
        ].filter(Boolean).join('\n');

        const html = `
            <h2>Emergency Alert</h2>
            <p><strong>Patient:</strong> ${patientName || 'Patient'}</p>
            <p><strong>Condition:</strong> ${diagnosis?.prediction || 'Critical'} | <strong>Risk:</strong> ${riskPercent}%</p>
            <p><strong>Triage:</strong> ${triage}</p>
            <p><strong>Location:</strong> <a href="${mapsLink}">${mapsLink}</a></p>
            ${symptoms ? `<p><strong>Symptoms:</strong> ${symptoms}</p>` : ''}
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p>Sent via MedAI Rural Health</p>
        `;

        try {
            const result = await this.sendMail({
                to: this.alertEmail,
                subject,
                text,
                html
            });
            console.log(`Emergency email delivered to ${this.alertEmail}`);
            return result;
        } catch (error) {
            error.code = error.code || 'EMAIL_DELIVERY_FAILED';
            throw error;
        }
    }

    async sendConsultationEmail({
        to,
        patientName,
        doctorName,
        hospitalName,
        meetingTime,
        meetingLink,
        bookingId,
        transactionId,
        template = 'booking_confirmation',
        statusLabel
    }) {
        if (!to) {
            const error = new Error('Recipient email is required');
            error.code = 'EMAIL_RECIPIENT_MISSING';
            throw error;
        }

        const subjectMap = {
            payment_confirmation: `Payment received for consultation ${bookingId}`,
            booking_confirmation: `Consultation confirmed with ${doctorName}`,
            booking_cancellation: `Consultation ${bookingId} cancelled`,
            consultation_reminder: `Reminder: consultation at ${meetingTime ? new Date(meetingTime).toLocaleString() : 'scheduled time'}`
        };

        const subject = subjectMap[template] || `Consultation update for booking ${bookingId}`;
        const when = meetingTime ? new Date(meetingTime).toLocaleString() : 'To be scheduled';
        const text = [
            `Hello ${patientName || 'Patient'},`,
            '',
            statusLabel || 'Your consultation has been updated.',
            bookingId ? `Booking ID: ${bookingId}` : null,
            doctorName ? `Doctor: ${doctorName}` : null,
            hospitalName ? `Hospital: ${hospitalName}` : null,
            `Meeting time: ${when}`,
            meetingLink ? `Meeting link: ${meetingLink}` : null,
            transactionId ? `Transaction ID: ${transactionId}` : null,
            '',
            'Thank you for using MedAI.'
        ].filter(Boolean).join('\n');

        const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
                <h2 style="margin-bottom: 12px;">Consultation Update</h2>
                <p>Hello ${patientName || 'Patient'},</p>
                <p>${statusLabel || 'Your consultation has been updated.'}</p>
                <ul style="padding-left: 18px;">
                    ${bookingId ? `<li><strong>Booking ID:</strong> ${bookingId}</li>` : ''}
                    ${doctorName ? `<li><strong>Doctor:</strong> ${doctorName}</li>` : ''}
                    ${hospitalName ? `<li><strong>Hospital:</strong> ${hospitalName}</li>` : ''}
                    <li><strong>Meeting time:</strong> ${when}</li>
                    ${meetingLink ? `<li><strong>Meeting link:</strong> <a href="${meetingLink}">${meetingLink}</a></li>` : ''}
                    ${transactionId ? `<li><strong>Transaction ID:</strong> ${transactionId}</li>` : ''}
                </ul>
                <p>Thank you for using MedAI.</p>
            </div>
        `;

        return this.sendMail({ to, subject, text, html });
    }
}

module.exports = new EmailService();
