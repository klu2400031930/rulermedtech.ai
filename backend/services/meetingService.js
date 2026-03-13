const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

class MeetingService {
    constructor() {
        this.provider = process.env.MEETING_PROVIDER || 'jitsi';
        this.baseUrl = process.env.MEETING_BASE_URL
            || (this.provider === 'internal' ? 'https://meet.medai.local/session' : 'https://meet.jit.si');
        this.googleTokenUri = process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token';
        this.googleMeetApiBaseUrl = process.env.GOOGLE_MEET_API_BASE_URL || 'https://meet.googleapis.com/v2';
        this.googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
        this.googlePrivateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        this.googleImpersonatedUserEmail = process.env.GOOGLE_IMPERSONATED_USER_EMAIL || '';
        this.googleScope = process.env.GOOGLE_MEET_SCOPE || 'https://www.googleapis.com/auth/meetings.space.created';
    }

    hasGoogleMeetConfig() {
        return Boolean(this.googleClientEmail && this.googlePrivateKey && this.googleImpersonatedUserEmail);
    }

    sanitizeSegment(value, fallback) {
        const sanitized = String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 24);

        return sanitized || fallback;
    }

    normalizeBaseUrl() {
        return String(this.baseUrl || '').replace(/\/+$/, '');
    }

    buildJitsiRoomName({ bookingId, doctorName, patientName }) {
        const bookingSegment = String(bookingId || '').slice(-8).toLowerCase() || crypto.randomBytes(4).toString('hex');
        const doctorSegment = this.sanitizeSegment(doctorName, 'doctor');
        const patientSegment = this.sanitizeSegment(patientName, 'patient');
        return `medai-${bookingSegment}-${doctorSegment}-${patientSegment}`;
    }

    needsMeetingRefresh(meeting) {
        const provider = String(meeting?.provider || '').toLowerCase();
        const meetingLink = String(meeting?.meetingLink || '').toLowerCase();

        return !meetingLink
            || provider === 'internal'
            || meetingLink.includes('meet.medai.local');
    }

    createInternalMeetingPayload({ bookingId, meetingTime, doctorName, patientName, fallbackReason = null }) {
        const meetingId = `MED-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            booking: bookingId,
            meetingId,
            provider: 'internal',
            meetingLink: `${this.baseUrl}/${meetingId}`,
            meetingTime,
            doctorName,
            patientName,
            organizerEmail: null,
            providerMetadata: fallbackReason ? { fallbackReason } : undefined,
            meetingStatus: 'scheduled'
        };
    }

    createJitsiMeetingPayload({ bookingId, meetingTime, doctorName, patientName, fallbackReason = null }) {
        const roomName = this.buildJitsiRoomName({ bookingId, doctorName, patientName });
        return {
            booking: bookingId,
            meetingId: roomName,
            provider: 'jitsi',
            meetingLink: `${this.normalizeBaseUrl()}/${roomName}`,
            meetingTime,
            doctorName,
            patientName,
            organizerEmail: null,
            providerMetadata: {
                roomName,
                ...(fallbackReason ? { fallbackReason } : {})
            },
            meetingStatus: 'scheduled'
        };
    }

    async getGoogleAccessToken() {
        const issuedAt = Math.floor(Date.now() / 1000);
        const assertion = jwt.sign({
            iss: this.googleClientEmail,
            sub: this.googleImpersonatedUserEmail,
            scope: this.googleScope,
            aud: this.googleTokenUri,
            iat: issuedAt,
            exp: issuedAt + 3600
        }, this.googlePrivateKey, {
            algorithm: 'RS256',
            header: { typ: 'JWT' }
        });

        const body = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        });

        const response = await axios.post(this.googleTokenUri, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });

        return response.data.access_token;
    }

    async createGoogleMeetMeetingPayload({ bookingId, meetingTime, doctorName, patientName }) {
        const accessToken = await this.getGoogleAccessToken();
        const response = await axios.post(`${this.googleMeetApiBaseUrl}/spaces`, {}, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        const space = response.data || {};
        const meetingId = space.name || `meet-${crypto.randomBytes(4).toString('hex')}`;
        const meetingLink = space.meetingUri || (space.meetingCode ? `https://meet.google.com/${space.meetingCode}` : null);

        if (!meetingLink) {
            throw new Error('Google Meet did not return a join link');
        }

        return {
            booking: bookingId,
            meetingId,
            provider: 'google_meet',
            meetingLink,
            meetingTime,
            doctorName,
            patientName,
            organizerEmail: this.googleImpersonatedUserEmail,
            providerMetadata: {
                spaceName: space.name,
                meetingCode: space.meetingCode,
                meetingUri: space.meetingUri,
                config: space.config || null
            },
            meetingStatus: 'scheduled'
        };
    }

    async createMeetingPayload({ bookingId, meetingTime, doctorName, patientName }) {
        if (this.provider === 'google_meet') {
            if (!this.hasGoogleMeetConfig()) {
                return this.createJitsiMeetingPayload({
                    bookingId,
                    meetingTime,
                    doctorName,
                    patientName,
                    fallbackReason: 'Google Meet credentials are not configured'
                });
            }

            try {
                return await this.createGoogleMeetMeetingPayload({
                    bookingId,
                    meetingTime,
                    doctorName,
                    patientName
                });
            } catch (error) {
                return this.createJitsiMeetingPayload({
                    bookingId,
                    meetingTime,
                    doctorName,
                    patientName,
                    fallbackReason: error.message
                });
            }
        }

        if (this.provider === 'internal') {
            return this.createInternalMeetingPayload({
                bookingId,
                meetingTime,
                doctorName,
                patientName
            });
        }

        if (this.provider === 'jitsi') {
            return this.createJitsiMeetingPayload({
                bookingId,
                meetingTime,
                doctorName,
                patientName
            });
        }

        return this.createInternalMeetingPayload({
            bookingId,
            meetingTime,
            doctorName,
            patientName
        });
    }
}

module.exports = new MeetingService();
