const express = require('express');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { generateToken, protect } = require('../middleware/auth');
const router = express.Router();

const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{9,}$/;

// @route POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, role, phone, location, specialization, consultationFee, hospitalName } = req.body;
        if (!PASSWORD_RULES.test(password || '')) {
            return res.status(400).json({
                message: 'Password must be at least 9 characters and include uppercase, lowercase, number, and special character.'
            });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const user = await User.create({ name, email, password, role: role || 'patient', phone, location });

        if (user.role === 'doctor') {
            await Doctor.create({
                user: user._id,
                name,
                hospitalName: hospitalName || 'Independent Online Practice',
                specialization: specialization || 'General Medicine',
                phone,
                consultationFee: consultationFee || 500,
                available: true,
                consultationEnabled: true
            });
        }

        const token = generateToken(user);
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const token = generateToken(user);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            location: user.location,
            token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route PUT /api/auth/me
router.put('/me', protect, async (req, res) => {
    try {
        const updates = {};
        if (typeof req.body.name === 'string' && req.body.name.trim()) {
            updates.name = req.body.name.trim();
        }
        if (typeof req.body.phone === 'string') {
            updates.phone = req.body.phone.trim();
        }
        if (req.body.location && typeof req.body.location === 'object') {
            const { lat, lng } = req.body.location;
            if (typeof lat === 'number' && typeof lng === 'number') {
                updates.location = { lat, lng };
            }
        }

        const user = await User.findByIdAndUpdate(req.user.id, updates, {
            new: true,
            runValidators: true
        }).select('-password');

        if (!user) return res.status(404).json({ message: 'User not found' });

        const token = generateToken(user);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            location: user.location,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
