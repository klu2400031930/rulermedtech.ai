// Simulates ambulance GPS movement from hospital → patient
// Emits location updates every 3 seconds via Socket.IO

class AmbulanceTracker {
    constructor(io) {
        this.io = io;
        this.activeTracking = new Map(); // emergencyId → interval
    }

    // Start tracking an ambulance for an emergency
    startTracking(emergencyId, hospitalLocation, patientLocation, ambulanceId, etaMinutes) {
        // Stop any existing tracking for this emergency
        this.stopTracking(emergencyId);

        const totalSteps = Math.max(10, Math.round(etaMinutes * 20 / 3)); // ~20 updates per minute
        let currentStep = 0;

        const startLat = hospitalLocation.lat || hospitalLocation.latitude;
        const startLng = hospitalLocation.lng || hospitalLocation.longitude;
        const endLat = patientLocation.lat || patientLocation.latitude;
        const endLng = patientLocation.lng || patientLocation.longitude;

        console.log(`🚑 Tracking started: Emergency ${emergencyId}`);
        console.log(`   Route: (${startLat.toFixed(4)}, ${startLng.toFixed(4)}) → (${endLat.toFixed(4)}, ${endLng.toFixed(4)})`);
        console.log(`   ETA: ${etaMinutes} min, Steps: ${totalSteps}`);

        const interval = setInterval(() => {
            currentStep++;
            const progress = Math.min(1, currentStep / totalSteps);

            // Linear interpolation with slight randomness for realism
            const jitter = () => (Math.random() - 0.5) * 0.001;
            const currentLat = startLat + (endLat - startLat) * progress + jitter();
            const currentLng = startLng + (endLng - startLng) * progress + jitter();

            const remainingMinutes = Math.max(0, etaMinutes * (1 - progress));
            const distanceCovered = progress * this._haversine(startLat, startLng, endLat, endLng);
            const totalDistance = this._haversine(startLat, startLng, endLat, endLng);

            const locationUpdate = {
                emergencyId,
                ambulanceId,
                location: { lat: currentLat, lng: currentLng },
                progress: Math.round(progress * 100),
                eta: Math.round(remainingMinutes),
                distanceCovered: Math.round(distanceCovered * 10) / 10,
                totalDistance: Math.round(totalDistance * 10) / 10,
                speed: Math.round(40 + Math.random() * 20), // 40-60 km/h
                timestamp: new Date().toISOString()
            };

            this.io.emit('ambulance:location', locationUpdate);

            if (progress >= 1) {
                this.io.emit('ambulance:arrived', { emergencyId, ambulanceId });
                console.log(`🚑 ✓ Ambulance arrived: Emergency ${emergencyId}`);
                this.stopTracking(emergencyId);
            }
        }, 3000); // Every 3 seconds

        this.activeTracking.set(emergencyId, interval);
    }

    stopTracking(emergencyId) {
        const interval = this.activeTracking.get(emergencyId);
        if (interval) {
            clearInterval(interval);
            this.activeTracking.delete(emergencyId);
        }
    }

    stopAll() {
        for (const [id, interval] of this.activeTracking) {
            clearInterval(interval);
        }
        this.activeTracking.clear();
    }

    _haversine(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

module.exports = AmbulanceTracker;
