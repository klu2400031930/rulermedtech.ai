const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String },
    patientLocation: {
        lat: { type: Number },
        lng: { type: Number }
    },
    diagnosis: {
        prediction: String,
        riskScore: Number,
        riskLevel: String,
        confidence: Number
    },
    assignedHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    assignedHospitalName: { type: String },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    assignedDoctorName: { type: String },
    bedReserved: { type: Boolean, default: false },
    bedType: { type: String },
    ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance' },
    ambulanceStatus: { type: String, enum: ['pending', 'dispatched', 'en-route', 'arrived', 'returning'], default: 'pending' },
    ambulanceVehicle: { type: String },
    estimatedArrival: { type: Number }, // in minutes
    status: { type: String, enum: ['active', 'in-progress', 'resolved', 'cancelled'], default: 'active' },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Emergency', emergencySchema);
