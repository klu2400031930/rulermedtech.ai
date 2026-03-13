const fs = require('fs');
const path = require('path');

// Haversine distance calculation
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Load hospital dataset
function loadHospitalDataset() {
    const filePath = path.join(__dirname, '..', 'data', 'hospitals_india.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

// Find nearest hospitals sorted by distance
function findNearestHospitals(patientLat, patientLng, options = {}) {
    const { limit = 5, requireICU = false, requireAmbulance = false } = options;
    let hospitals = loadHospitalDataset();

    if (requireICU) hospitals = hospitals.filter(h => h.icuBedsAvailable > 0);
    if (requireAmbulance) hospitals = hospitals.filter(h => h.ambulancesAvailable > 0);

    return hospitals
        .map(h => ({
            ...h,
            distance: getDistance(patientLat, patientLng, h.latitude, h.longitude)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

// Find best hospital for emergency (considers beds, distance, rating)
function findBestEmergencyHospital(patientLat, patientLng) {
    const hospitals = loadHospitalDataset();
    const scored = hospitals
        .filter(h => h.icuBedsAvailable > 0 || h.emergencyBedsAvailable > 0)
        .map(h => {
            const dist = getDistance(patientLat, patientLng, h.latitude, h.longitude);
            const distScore = Math.max(0, 1 - dist / 100); // closer = better
            const bedScore = (h.icuBedsAvailable + h.emergencyBedsAvailable) / (h.icuBedsTotal + h.emergencyBedsTotal);
            const ratingScore = h.rating / 5;
            const totalScore = distScore * 0.5 + bedScore * 0.3 + ratingScore * 0.2;
            return { ...h, distance: dist, score: totalScore };
        })
        .sort((a, b) => b.score - a.score);

    return scored[0] || null;
}

module.exports = { loadHospitalDataset, findNearestHospitals, findBestEmergencyHospital, getDistance };
