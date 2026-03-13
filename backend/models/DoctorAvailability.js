const mongoose = require('mongoose');

const doctorAvailabilitySchema = new mongoose.Schema({
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    date: { type: Date, required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    slotStartTime: { type: String, required: true },
    slotEndTime: { type: String, required: true },
    consultationFee: { type: Number, required: true, min: 0 },
    isOnline: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['available', 'locked', 'booked', 'cancelled', 'completed'],
        default: 'available',
        index: true
    },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockExpiresAt: { type: Date, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking' },
    notes: { type: String }
}, { timestamps: true });

doctorAvailabilitySchema.index({ doctor: 1, startsAt: 1 }, { unique: true });

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
