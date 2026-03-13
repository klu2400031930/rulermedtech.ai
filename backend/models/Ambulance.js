const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    hospitalName: { type: String },
    vehicleNumber: { type: String, required: true },
    status: { type: String, enum: ['available', 'dispatched', 'returning', 'maintenance'], default: 'available' },
    currentLocation: {
        lat: { type: Number },
        lng: { type: Number }
    },
    driverName: { type: String },
    driverPhone: { type: String },
    type: { type: String, enum: ['ALS', 'BLS', 'Patient Transport'], default: 'BLS' }
}, { timestamps: true });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
