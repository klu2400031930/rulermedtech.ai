const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    phone: { type: String },
    icuBedsTotal: { type: Number, default: 10 },
    icuBedsAvailable: { type: Number, default: 10 },
    emergencyBedsTotal: { type: Number, default: 20 },
    emergencyBedsAvailable: { type: Number, default: 20 },
    generalBedsTotal: { type: Number, default: 50 },
    generalBedsAvailable: { type: Number, default: 50 },
    ambulancesTotal: { type: Number, default: 5 },
    ambulancesAvailable: { type: Number, default: 5 },
    specialists: [{ type: String }],
    servicesProvided: [{ type: String }],
    contactEmail: { type: String },
    rating: { type: Number, default: 4.0 }
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
