const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking', required: true, unique: true, index: true },
    meetingId: { type: String, required: true, unique: true },
    provider: { type: String, default: 'internal' },
    meetingLink: { type: String, required: true },
    organizerEmail: { type: String },
    meetingTime: { type: Date, required: true },
    doctorName: { type: String },
    patientName: { type: String },
    providerMetadata: { type: mongoose.Schema.Types.Mixed },
    meetingStatus: {
        type: String,
        enum: ['scheduled', 'live', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    startedAt: { type: Date },
    endedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
