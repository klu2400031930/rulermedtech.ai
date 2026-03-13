const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    hospitalName: { type: String },
    specialization: { type: String, required: true },
    available: { type: Boolean, default: true },
    consultationEnabled: { type: Boolean, default: true },
    currentPatients: { type: Number, default: 0 },
    maxPatients: { type: Number, default: 5 },
    phone: { type: String },
    experience: { type: Number, default: 5 },
    consultationFee: { type: Number, default: 500 },
    bio: { type: String, default: 'Online consultation specialist.' },
    languages: [{ type: String }],
    consultationModes: [{ type: String, enum: ['online', 'video', 'audio'], default: 'online' }],
    rating: { type: Number, default: 4.5 },
    reviews: [{
        patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        patientName: { type: String },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
