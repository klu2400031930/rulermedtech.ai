const express = require('express');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Ambulance = require('../models/Ambulance');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @route GET /api/hospitals
router.get('/', async (req, res) => {
    try {
        const hospitals = await Hospital.find();
        res.json(hospitals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/hospitals/:id
router.get('/:id', async (req, res) => {
    try {
        const hospital = await Hospital.findById(req.params.id);
        if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

        const doctors = await Doctor.find({ hospital: hospital._id });
        const ambulances = await Ambulance.find({ hospital: hospital._id });

        res.json({ ...hospital.toObject(), doctors, ambulances });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/hospitals/:id/availability
router.get('/:id/availability', async (req, res) => {
    try {
        const hospital = await Hospital.findById(req.params.id);
        if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

        const availableDoctors = await Doctor.find({ hospital: hospital._id, available: true });
        const availableAmbulances = await Ambulance.find({ hospital: hospital._id, status: 'available' });

        res.json({
            hospital: hospital.name,
            icuBedsAvailable: hospital.icuBedsAvailable,
            emergencyBedsAvailable: hospital.emergencyBedsAvailable,
            generalBedsAvailable: hospital.generalBedsAvailable,
            availableDoctors: availableDoctors.length,
            doctors: availableDoctors,
            availableAmbulances: availableAmbulances.length,
            ambulances: availableAmbulances
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
