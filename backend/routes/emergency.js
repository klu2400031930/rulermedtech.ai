const express = require('express');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Ambulance = require('../models/Ambulance');
const Emergency = require('../models/Emergency');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Calculate distance between two coordinates (Haversine)
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// @route POST /api/emergency/trigger
router.post('/trigger', protect, async (req, res) => {
    try {
        const { diagnosis, patientLocation } = req.body;
        const patientLat = patientLocation?.lat || 17.3850;
        const patientLng = patientLocation?.lng || 78.4867;

        // 1. Find nearest hospitals
        const hospitals = await Hospital.find();
        const sorted = hospitals
            .map(h => ({
                ...h.toObject(),
                distance: getDistance(patientLat, patientLng, h.location.lat, h.location.lng)
            }))
            .sort((a, b) => a.distance - b.distance);

        // 2. Find hospital with available resources
        let selectedHospital = null;
        for (const h of sorted) {
            if (h.icuBedsAvailable > 0 || h.emergencyBedsAvailable > 0) {
                selectedHospital = h;
                break;
            }
        }
        if (!selectedHospital) selectedHospital = sorted[0];

        // 3. Find available doctor
        const doctors = await Doctor.find({ hospital: selectedHospital._id, available: true })
            .sort({ currentPatients: 1 });
        const selectedDoctor = doctors[0] || null;

        // 4. Find available ambulance
        // Try to find ambulance at selected hospital first, then fallback to any available
        let ambulances = await Ambulance.find({ hospital: selectedHospital._id, status: 'available' });
        if (ambulances.length === 0) {
            ambulances = await Ambulance.find({ status: 'available' });
        }
        const selectedAmbulance = ambulances[0] || null;

        // 5. Reserve bed
        const bedType = selectedHospital.icuBedsAvailable > 0 ? 'ICU' : 'Emergency';
        if (bedType === 'ICU') {
            await Hospital.findByIdAndUpdate(selectedHospital._id, { $inc: { icuBedsAvailable: -1 } });
        } else {
            await Hospital.findByIdAndUpdate(selectedHospital._id, { $inc: { emergencyBedsAvailable: -1 } });
        }

        // 6. Update doctor availability
        if (selectedDoctor) {
            await Doctor.findByIdAndUpdate(selectedDoctor._id, { $inc: { currentPatients: 1 } });
        }

        // 7. Dispatch ambulance
        if (selectedAmbulance) {
            await Ambulance.findByIdAndUpdate(selectedAmbulance._id, {
                status: 'dispatched',
                currentLocation: { lat: selectedHospital.location.lat, lng: selectedHospital.location.lng }
            });
        }

        // Calculate ETA (assume 40km/h average, minimum 5 min)
        const eta = Math.max(5, Math.round((selectedHospital.distance / 40) * 60));

        // 8. Create emergency record
        const emergency = await Emergency.create({
            patient: req.user.id,
            patientName: req.user.name,
            patientLocation: { lat: patientLat, lng: patientLng },
            diagnosis: {
                prediction: diagnosis.prediction,
                riskScore: diagnosis.risk_score || diagnosis.riskScore,
                riskLevel: diagnosis.risk_level || diagnosis.riskLevel,
                confidence: diagnosis.confidence
            },
            assignedHospital: selectedHospital._id,
            assignedHospitalName: selectedHospital.name,
            assignedDoctor: selectedDoctor?._id,
            assignedDoctorName: selectedDoctor?.name || 'Pending Assignment',
            bedReserved: true,
            bedType,
            ambulanceId: selectedAmbulance?._id,
            ambulanceStatus: selectedAmbulance ? 'dispatched' : 'pending',
            ambulanceVehicle: selectedAmbulance?.vehicleNumber || 'N/A',
            estimatedArrival: eta,
            status: 'active'
        });

        // Emit WebSocket event
        if (req.app.get('io')) {
            req.app.get('io').emit('emergency:new', emergency);
        }

        // Send SMS alerts
        try {
            const smsService = require('../services/smsService');
            await smsService.sendEmergencyAlerts({
                patientName: req.user.name,
                hospitalName: selectedHospital.name,
                doctorName: selectedDoctor?.name || 'Pending',
                ambulanceVehicle: selectedAmbulance?.vehicleNumber,
                estimatedArrival: eta,
                diagnosis,
                bedType,
                patientLat,
                patientLng
            });
        } catch (smsErr) {
            console.error('SMS alert error (non-fatal):', smsErr.message);
        }

        // Start ambulance GPS tracking simulation
        const tracker = req.app.get('ambulanceTracker');
        if (tracker && selectedAmbulance) {
            tracker.startTracking(
                emergency._id.toString(),
                selectedHospital.location,
                { lat: patientLat, lng: patientLng },
                selectedAmbulance._id?.toString(),
                eta
            );
        }

        res.status(201).json({
            emergency,
            hospital: {
                name: selectedHospital.name,
                distance: selectedHospital.distance,
                distanceText: `${selectedHospital.distance.toFixed(1)} km`,
                location: selectedHospital.location,
                phone: selectedHospital.phone
            },
            doctor: selectedDoctor ? {
                name: selectedDoctor.name,
                specialization: selectedDoctor.specialization,
                phone: selectedDoctor.phone,
                experience: selectedDoctor.experience
            } : null,
            ambulance: selectedAmbulance ? {
                vehicleNumber: selectedAmbulance.vehicleNumber,
                driverName: selectedAmbulance.driverName,
                driverPhone: selectedAmbulance.driverPhone,
                type: selectedAmbulance.type
            } : null,
            bedType,
            estimatedArrival: eta
        });
    } catch (error) {
        console.error('Emergency trigger error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/emergency/active
router.get('/active', protect, async (req, res) => {
    try {
        const emergencies = await Emergency.find({ status: { $in: ['active', 'in-progress'] } })
            .sort({ createdAt: -1 });
        res.json(emergencies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/emergency/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const emergency = await Emergency.findById(req.params.id);
        if (!emergency) return res.status(404).json({ message: 'Emergency not found' });
        res.json(emergency);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route PUT /api/emergency/:id/status
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { status, ambulanceStatus, notes } = req.body;
        const update = {};
        if (status) update.status = status;
        if (ambulanceStatus) update.ambulanceStatus = ambulanceStatus;
        if (notes) update.notes = notes;

        const emergency = await Emergency.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!emergency) return res.status(404).json({ message: 'Emergency not found' });

        if (req.app.get('io')) {
            req.app.get('io').emit('emergency:update', emergency);
        }

        res.json(emergency);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
