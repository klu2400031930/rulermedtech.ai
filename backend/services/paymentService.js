const axios = require('axios');
const crypto = require('crypto');

class PaymentService {
    constructor() {
        this.defaultGateway = process.env.PAYMENT_GATEWAY || 'simulated';
        this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        this.razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
        this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    }

    getConfiguredGateway(preferredGateway) {
        const gateway = preferredGateway || this.defaultGateway;
        if (gateway === 'stripe' && this.stripeSecretKey) return 'stripe';
        if (gateway === 'razorpay' && this.razorpayKeyId && this.razorpayKeySecret) return 'razorpay';
        return 'simulated';
    }

    async createPaymentOrder({ gateway, amount, currency = 'INR', bookingId, patientId, doctorId }) {
        const selectedGateway = this.getConfiguredGateway(gateway);

        if (selectedGateway === 'stripe') {
            const body = new URLSearchParams({
                amount: String(Math.round(amount * 100)),
                currency: currency.toLowerCase(),
                description: `Consultation booking ${bookingId}`,
                'metadata[bookingId]': String(bookingId),
                'metadata[patientId]': String(patientId),
                'metadata[doctorId]': String(doctorId)
            });

            const response = await axios.post('https://api.stripe.com/v1/payment_intents', body.toString(), {
                headers: {
                    Authorization: `Bearer ${this.stripeSecretKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            });

            return {
                gateway: 'stripe',
                orderId: response.data.id,
                clientSecret: response.data.client_secret,
                amount,
                currency
            };
        }

        if (selectedGateway === 'razorpay') {
            const response = await axios.post('https://api.razorpay.com/v1/orders', {
                amount: Math.round(amount * 100),
                currency,
                receipt: String(bookingId),
                notes: { bookingId: String(bookingId), patientId: String(patientId), doctorId: String(doctorId) }
            }, {
                auth: {
                    username: this.razorpayKeyId,
                    password: this.razorpayKeySecret
                },
                timeout: 15000
            });

            return {
                gateway: 'razorpay',
                orderId: response.data.id,
                keyId: this.razorpayKeyId,
                amount,
                currency
            };
        }

        const orderId = `sim_order_${crypto.randomBytes(6).toString('hex')}`;
        return {
            gateway: 'simulated',
            orderId,
            amount,
            currency,
            instructions: 'Use the simulated checkout flow to mark payment as successful or failed.'
        };
    }

    async verifyPayment({ gateway, orderId, amount, payload = {} }) {
        const selectedGateway = this.getConfiguredGateway(gateway);

        if (selectedGateway === 'stripe') {
            if (!payload.paymentIntentId) {
                return { success: false, reason: 'Missing Stripe payment intent ID' };
            }

            const response = await axios.get(`https://api.stripe.com/v1/payment_intents/${payload.paymentIntentId}`, {
                headers: { Authorization: `Bearer ${this.stripeSecretKey}` },
                timeout: 15000
            });

            if (response.data.status !== 'succeeded') {
                return { success: false, reason: `Stripe status is ${response.data.status}` };
            }

            return {
                success: true,
                transactionId: response.data.latest_charge || response.data.id,
                gatewayPaymentId: response.data.id,
                raw: response.data
            };
        }

        if (selectedGateway === 'razorpay') {
            const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = payload;
            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
                return { success: false, reason: 'Missing Razorpay verification payload' };
            }

            const expectedSignature = crypto
                .createHmac('sha256', this.razorpayKeySecret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest('hex');

            if (expectedSignature !== razorpaySignature || razorpayOrderId !== orderId) {
                return { success: false, reason: 'Razorpay signature verification failed' };
            }

            return {
                success: true,
                transactionId: razorpayPaymentId,
                gatewayPaymentId: razorpayPaymentId,
                gatewaySignature: razorpaySignature,
                raw: payload
            };
        }

        if (payload.forceFailure) {
            return { success: false, reason: payload.reason || 'Simulated payment failed' };
        }

        return {
            success: true,
            transactionId: payload.transactionId || `SIMTXN-${Date.now()}`,
            gatewayPaymentId: payload.transactionId || `SIMPAY-${Date.now()}`,
            raw: {
                gateway: 'simulated',
                orderId,
                amount
            }
        };
    }
}

module.exports = new PaymentService();
