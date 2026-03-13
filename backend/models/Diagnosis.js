const mongoose = require('mongoose');

const diagnosisSchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String },
    symptoms: [{ type: String }],
    vitals: {
        heartRate: Number,
        bpSystolic: Number,
        bpDiastolic: Number,
        temperature: Number,
        spo2: Number,
        age: Number
    },
    prediction: { type: String },
    confidence: { type: Number },
    riskScore: { type: Number },
    riskLevel: { type: String, enum: ['Routine', 'Urgent', 'Emergency'] },
    explanation: [{ feature: String, importance: Number, value: Number }],
    allProbabilities: { type: Map, of: Number },
    emergencyTriggered: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Diagnosis', diagnosisSchema);
