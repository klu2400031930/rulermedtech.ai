const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/auth');

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// @route POST /api/chatbot/ask
router.post('/ask', protect, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const aiResponse = await axios.post(`${ML_SERVICE_URL}/ai/chatbot`, { message });
        return res.status(200).json(aiResponse.data);
    } catch (error) {
        console.error('Chatbot error:', error.message);
        return res.status(200).json({
            reply: 'Chatbot service is unavailable right now.',
            precautions: ['Rest and stay hydrated.', 'Seek medical care if symptoms worsen.'],
            suggestions: [],
            matched: { symptoms: [], disease: null },
            disclaimer: 'This is general guidance and not medical advice.'
        });
    }
});

module.exports = router;
