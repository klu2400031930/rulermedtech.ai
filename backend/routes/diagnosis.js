const express = require('express');
const axios = require('axios');
const Diagnosis = require('../models/Diagnosis');
const { protect } = require('../middleware/auth');
const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// @route POST /api/diagnosis
router.post('/', protect, async (req, res) => {
    try {
        const { symptoms, heartRate, bpSystolic, bpDiastolic, temperature, spo2, age } = req.body;

        // Call ML service
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
            symptoms,
            heart_rate: heartRate || 75,
            bp_systolic: bpSystolic || 120,
            bp_diastolic: bpDiastolic || 80,
            temperature: temperature || 37.0,
            spo2: spo2 || 97,
            age: age || 30
        });

        const result = mlResponse.data;

        // Save diagnosis
        const diagnosis = await Diagnosis.create({
            patient: req.user.id,
            patientName: req.user.name,
            symptoms,
            vitals: { heartRate, bpSystolic, bpDiastolic, temperature, spo2, age },
            prediction: result.prediction,
            confidence: result.confidence,
            riskScore: result.risk_score,
            riskLevel: result.risk_level,
            explanation: result.explanation,
            allProbabilities: result.all_probabilities
        });

        res.status(201).json({
            _id: diagnosis._id,
            ...result,
            diagnosisId: diagnosis._id
        });
    } catch (error) {
        console.error('Diagnosis error:', error.message);
        // Fallback with simulated response if ML service is down
        const fallbackResult = {
            prediction: 'Service Unavailable',
            confidence: 0,
            risk_score: 0.5,
            risk_level: 'Urgent',
            explanation: [{ feature: 'system', importance: 1, value: 0 }],
            all_probabilities: {},
            note: 'ML service unavailable, using fallback'
        };
        res.status(200).json(fallbackResult);
    }
});

// @route GET /api/diagnosis/history
router.get('/history', protect, async (req, res) => {
    try {
        const diagnoses = await Diagnosis.find({ patient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(diagnoses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/diagnosis/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const diagnosis = await Diagnosis.findById(req.params.id);
        if (!diagnosis) return res.status(404).json({ message: 'Diagnosis not found' });
        res.json(diagnosis);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

// --- After main router export, add AI proxy routes ---
// These proxy symptom interpretation, autocomplete, and explanation to the FastAPI AI service

// @route POST /api/diagnosis/interpret
router.post('/interpret', protect, async (req, res) => {
    try {
        const { text, language } = req.body;
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/ai/interpretSymptoms`, { text, language: language || 'en' });
        res.json(mlResponse.data);
    } catch (error) {
        console.error('Interpret error:', error.message);
        res.status(200).json({ symptoms: [], details: [], unrecognized: [req.body.text], symptom_count: 0 });
    }
});

// @route POST /api/diagnosis/autocomplete
router.post('/autocomplete', protect, async (req, res) => {
    try {
        const { text } = req.body;
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/ai/autocomplete`, { text });
        res.json(mlResponse.data);
    } catch (error) {
        console.error('Autocomplete error:', error.message);
        res.status(200).json({ suggestions: [] });
    }
});

// @route POST /api/diagnosis/explain
router.post('/explain', protect, async (req, res) => {
    try {
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/ai/explainDiagnosis`, req.body);
        res.json(mlResponse.data);
    } catch (error) {
        console.error('Explain error:', error.message);
        res.status(200).json({ explanation_text: 'AI explanation service temporarily unavailable.' });
    }
});
