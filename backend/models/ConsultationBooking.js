const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
    status: { type: String, required: true },
    note: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByRole: { type: String },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

const consultationBookingSchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorAvailability', required: true, index: true },
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
    consultationDate: { type: Date, required: true, index: true },
    slotStartTime: { type: String, required: true },
    slotEndTime: { type: String, required: true },
    consultationFee: { type: Number, required: true, min: 0 },
    gateway: { type: String, default: 'simulated' },
    bookingStatus: {
        type: String,
        enum: ['pending_payment', 'payment_completed', 'confirmed', 'rejected', 'cancelled', 'completed', 'rescheduled'],
        default: 'pending_payment',
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
        index: true
    },
    refundStatus: {
        type: String,
        enum: ['not_requested', 'pending', 'processed'],
        default: 'not_requested'
    },
    reason: { type: String },
    notes: { type: String },
    cancellationReason: { type: String },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking' },
    reminderSentAt: { type: Date },
    statusHistory: [statusHistorySchema]
}, { timestamps: true });

consultationBookingSchema.index({ doctor: 1, consultationDate: 1 });
consultationBookingSchema.index({ patient: 1, consultationDate: -1 });

module.exports = mongoose.model('ConsultationBooking', consultationBookingSchema);
