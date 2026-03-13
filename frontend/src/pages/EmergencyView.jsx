import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    MapPin, Truck, User, Building2, Clock, Phone, Shield,
    Bed, CheckCircle2, Siren, Heart
} from 'lucide-react';
import { getSocket } from '../utils/socket';
import { useAccessibility } from '../components/AccessibilityProvider';

// Leaflet will be loaded dynamically to avoid SSR issues
let L = null;

export default function EmergencyView() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useAccessibility();
    const emergencyData = location.state;
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const ambulanceMarkerRef = useRef(null);

    const [ambulanceProgress, setAmbulanceProgress] = useState(0);
    const [currentETA, setCurrentETA] = useState(0);
    const [statusSteps, setStatusSteps] = useState([]);

    // Extract data
    const emergency = emergencyData?.emergency || {};
    const hospital = emergencyData?.hospital || {};
    const doctor = emergencyData?.doctor || {};
    const ambulance = emergencyData?.ambulance || {};
    const bedType = emergencyData?.bedType || 'ICU';
    const patientLocation = emergencyData?.patientLocation || { lat: 17.3850, lng: 78.4867 };

    // Parse ETA properly
    const rawETA = emergencyData?.estimatedArrival || emergency.estimatedArrival || 15;
    const parsedETA = typeof rawETA === 'string' ? parseInt(rawETA) || 15 : rawETA;

    // Fix doctor name
    const doctorDisplayName = (() => {
        const rawName = doctor?.name || emergency.assignedDoctorName || 'Specialist';
        return rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`;
    })();

    if (!emergencyData) {
        return (
            <div className="text-center py-20">
                <Siren size={60} className="mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-semibold text-text-primary">{t('noActiveEmergency')}</h2>
                <p className="text-text-secondary mt-2">{t('emergencyDataNotFound')}</p>
                <button onClick={() => navigate('/symptoms')} className="btn-primary mt-4">
                    <Heart size={18} /> {t('startSymptomCheck')}
                </button>
            </div>
        );
    }

    // Initialize Leaflet map
    useEffect(() => {
        let isMounted = true;

        const initMap = async () => {
            try {
                const leaflet = await import('leaflet');
                L = leaflet.default || leaflet;

                // Import leaflet CSS
                if (!document.querySelector('link[href*="leaflet"]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                    document.head.appendChild(link);
                }

                if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

                const hospitalLat = hospital.location?.lat || 17.3750;
                const hospitalLng = hospital.location?.lng || 78.4800;
                const patientLat = patientLocation.lat || 17.3850;
                const patientLng = patientLocation.lng || 78.4867;
                const centerLat = (hospitalLat + patientLat) / 2;
                const centerLng = (hospitalLng + patientLng) / 2;

                const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '(c) OpenStreetMap'
                }).addTo(map);

                // Hospital marker
                const hospitalIcon = L.divIcon({
                    html: '<div style="background:#2563EB;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">H</div>',
                    iconSize: [32, 32],
                    className: ''
                });
                L.marker([hospitalLat, hospitalLng], { icon: hospitalIcon })
                    .addTo(map)
                    .bindPopup(`<b>${hospital.name || t('hospital')}</b><br/>${hospital.distanceText || ''}`);

                // Patient marker
                const patientIcon = L.divIcon({
                    html: '<div style="background:#EF4444;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">P</div>',
                    iconSize: [32, 32],
                    className: ''
                });
                L.marker([patientLat, patientLng], { icon: patientIcon })
                    .addTo(map)
                    .bindPopup(`<b>${t('youLabel')}</b>`);

                // Route line
                L.polyline([[hospitalLat, hospitalLng], [patientLat, patientLng]], {
                    color: '#2563EB', weight: 4, dashArray: '10 6', opacity: 0.7
                }).addTo(map);

                // Ambulance marker
                const ambulanceIcon = L.divIcon({
                    html: '<div style="background:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid #EF4444;box-shadow:0 2px 12px rgba(239,68,68,0.4);">A</div>',
                    iconSize: [36, 36],
                    className: ''
                });
                const ambMarker = L.marker([hospitalLat, hospitalLng], { icon: ambulanceIcon })
                    .addTo(map)
                    .bindPopup(`<b>${ambulance?.vehicleNumber || t('ambulance')}</b><br/>${t('enRoute')}`);

                map.fitBounds([[hospitalLat, hospitalLng], [patientLat, patientLng]], { padding: [50, 50] });

                mapInstanceRef.current = map;
                ambulanceMarkerRef.current = ambMarker;
            } catch (err) {
                console.error('Leaflet init error:', err);
            }
        };

        initMap();

        return () => {
            isMounted = false;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Socket.IO: listen for real-time ambulance location updates
    useEffect(() => {
        setCurrentETA(parsedETA);
        const socket = getSocket();

        const steps = [
            { label: t('emergencyTriggered'), detail: t('aiDetectedCriticalCondition'), done: true, time: t('inProgress') },
            { label: t('nearestHospitalFound'), detail: hospital.name || t('finding'), done: true, time: hospital.distanceText || t('calculated') },
            { label: `${t('doctor')} ${t('assigned')}`, detail: doctorDisplayName, done: !!doctor?.name, time: doctor?.specialization || '' },
            { label: `${bedType} ${t('bedType')}`, detail: `${t('hospital')}: ${hospital.name || t('hospital')}`, done: true, time: t('confirmed') },
            { label: t('ambulanceDispatched'), detail: ambulance?.vehicleNumber || t('searching'), done: !!ambulance?.vehicleNumber, time: ambulance?.driverName || t('driverEnRoute') },
            { label: t('ambulanceEnRoute'), detail: `${t('eta')}: ${parsedETA} min`, done: false, time: t('inProgress') },
            { label: t('arrivedAtPatient'), detail: t('waiting'), done: false, time: t('pendingStatus') },
        ];
        setStatusSteps(steps);

        // Real-time location from backend tracker
        socket.on('ambulance:location', (data) => {
            if (data.emergencyId === (emergency._id || '')) {
                setAmbulanceProgress(data.progress || 0);
                setCurrentETA(data.eta || 0);

                // Move marker on real map
                if (ambulanceMarkerRef.current && data.location) {
                    ambulanceMarkerRef.current.setLatLng([data.location.lat, data.location.lng]);
                }
            }
        });

        socket.on('ambulance:arrived', (data) => {
            if (data.emergencyId === (emergency._id || '')) {
                setAmbulanceProgress(100);
                setCurrentETA(0);
            }
        });

        // Fallback: simulate progress if no socket events after 5s
        const fallbackTimeout = setTimeout(() => {
            const interval = setInterval(() => {
                setAmbulanceProgress(prev => {
                    if (prev >= 100) { clearInterval(interval); return 100; }
                    return prev + 1.5;
                });
                setCurrentETA(prev => Math.max(1, prev - (parsedETA / (100 / 1.5))));
            }, 3000);
            return () => clearInterval(interval);
        }, 5000);

        return () => {
            clearTimeout(fallbackTimeout);
            socket.off('ambulance:location');
            socket.off('ambulance:arrived');
        };
    }, []);

    // Update timeline steps on progress
    useEffect(() => {
        if (ambulanceProgress > 50) {
            setStatusSteps(prev => prev.map((s, i) => i === 5 ? { ...s, done: true, time: t('inProgress') } : s));
        }
        if (ambulanceProgress >= 100) {
            setStatusSteps(prev => prev.map((s, i) => i === 6 ? { ...s, done: true, time: t('arrivedShort'), detail: t('ambulanceHasArrived') } : s));
        }
    }, [ambulanceProgress]);

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-4xl mx-auto space-y-6">

            {/* Emergency Banner */}
            <motion.div
                variants={itemVariants}
                className="p-6 rounded-2xl text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}
            >
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Siren size={22} />
                        </div>
                        <h1 className="text-2xl font-bold">{t('emergencyResponseActive')}</h1>
                    </div>
                    <p className="text-red-100 text-lg mt-1">
                        {t('condition')}: <span className="font-semibold text-white">{emergency.diagnosis?.prediction || t('status_emergency')}</span>
                        {' '}- {t('risk')}: <span className="font-semibold text-white">{Math.round((emergency.diagnosis?.riskScore || 0.9) * 100)}%</span>
                    </p>
                </div>
            </motion.div>

            {/* Auto-Booking Cards */}
            <motion.div variants={itemVariants}>
                <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-success" /> {t('autoBookingComplete')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stat-card border-2 border-blue-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 mb-3"><Building2 size={20} className="text-primary" /></div>
                        <p className="text-xs font-medium text-text-light uppercase tracking-wide">{t('hospital')} {t('assigned')}</p>
                        <p className="font-bold text-text-primary mt-1 text-sm leading-snug">{hospital.name || t('hospital')}</p>
                        <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> {hospital.distanceText || t('nearest')}</p>
                    </motion.div>
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stat-card border-2 border-teal-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-50 mb-3"><User size={20} className="text-teal" /></div>
                        <p className="text-xs font-medium text-text-light uppercase tracking-wide">{t('doctor')} {t('assigned')}</p>
                        <p className="font-bold text-text-primary mt-1 text-sm">{doctorDisplayName}</p>
                        <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> {doctor?.specialization || t('status_available')}</p>
                    </motion.div>
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stat-card border-2 border-green-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 mb-3"><Bed size={20} className="text-success" /></div>
                        <p className="text-xs font-medium text-text-light uppercase tracking-wide">{t('bedType')}</p>
                        <p className="font-bold text-text-primary mt-1 text-sm">{bedType} {t('bedType')}</p>
                        <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> {t('confirmed')}</p>
                    </motion.div>
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stat-card border-2 border-red-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 mb-3"><Truck size={20} className="text-emergency" /></div>
                        <p className="text-xs font-medium text-text-light uppercase tracking-wide">{t('ambulance')}</p>
                        <p className="font-bold text-text-primary mt-1 text-sm">{ambulance?.vehicleNumber || t('status_dispatched')}</p>
                        <p className="text-xs mt-2 flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-amber-700">{ambulance?.driverName || t('driverEnRoute')}</span>
                        </p>
                    </motion.div>
                </div>
            </motion.div>

            {/* Live Leaflet Map */}
            <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                            <MapPin size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-text-primary">{t('liveGpsTracking')}</h3>
                            <p className="text-xs text-text-secondary">{t('realTimeAmbulanceLocation')}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${ambulanceProgress >= 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${ambulanceProgress >= 100 ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className={`text-xs font-medium ${ambulanceProgress >= 100 ? 'text-green-700' : 'text-amber-700'}`}>
                            {ambulanceProgress >= 100 ? t('arrivedShort') : t('enRoute')}
                        </span>
                    </div>
                </div>

                {/* Leaflet Map Container */}
                <div ref={mapRef} className="h-72 rounded-xl overflow-hidden border border-slate-200 z-0" style={{ minHeight: '280px' }} />

                {/* Progress bar */}
                <div className="mt-4 relative">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-primary font-medium flex items-center gap-1"><Building2 size={12} /> {t('hospitalLabel')}</span>
                        <span className="text-emergency font-medium flex items-center gap-1"><MapPin size={12} /> {t('youLabel')}</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                        <motion.div className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, #2563EB, #14B8A6, #F59E0B, #EF4444)' }}
                            initial={{ width: 0 }} animate={{ width: `${ambulanceProgress}%` }}
                            transition={{ duration: 0.5 }} />
                        <motion.div
                            className="absolute top-1/2 -translate-y-1/2 text-xs font-bold text-white bg-red-500 rounded-full h-6 w-6 flex items-center justify-center shadow-md"
                            animate={{ left: `${Math.min(ambulanceProgress, 94)}%` }}
                            transition={{ duration: 0.5 }}
                        >
                            A
                        </motion.div>
                    </div>
                </div>

                {/* ETA Display */}
                <div className="flex items-center justify-center gap-4 p-5 rounded-2xl mt-4"
                    style={{ background: ambulanceProgress >= 100 ? '#D1FAE5' : 'linear-gradient(135deg, #FEF3C7, #FEE2E2)' }}>
                    {ambulanceProgress >= 100 ? (
                        <div className="text-center">
                            <CheckCircle2 size={40} className="text-success mx-auto mb-2" />
                            <p className="text-2xl font-bold text-green-800">{t('ambulanceHasArrived')}</p>
                        </div>
                    ) : (
                        <>
                            <Clock size={28} className="text-amber-600" />
                            <div>
                                <p className="text-sm text-amber-700">{t('estimatedArrival')}</p>
                                <p className="text-4xl font-bold text-amber-800">
                                    {Math.max(1, Math.round(currentETA))} <span className="text-lg">min</span>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Timeline */}
            <motion.div variants={itemVariants} className="stat-card">
                <h3 className="font-semibold text-text-primary mb-5 flex items-center gap-2">
                    <Shield size={18} className="text-primary" /> {t('emergencyResponseTimeline')}
                </h3>
                <div className="space-y-0">
                    {statusSteps.map((step, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.15 }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${step.done ? 'bg-green-500' : 'bg-slate-300'}`}>
                                    {step.done ? <CheckCircle2 size={16} /> : <span>{i + 1}</span>}
                                </motion.div>
                                {i < statusSteps.length - 1 && <div className={`w-0.5 h-10 ${step.done ? 'bg-green-300' : 'bg-slate-200'}`} />}
                            </div>
                            <div className="pb-6">
                                <p className={`font-medium text-sm ${step.done ? 'text-text-primary' : 'text-text-light'}`}>{step.label}</p>
                                <p className="text-xs text-text-secondary">{step.detail}</p>
                                <span className="text-[10px] text-text-light">{step.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Emergency Contacts */}
            <motion.div variants={itemVariants} className="stat-card">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><Phone size={18} /> {t('emergencyContacts')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a href="tel:108" className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center"><Phone size={16} className="text-red-700" /></div>
                        <div><p className="text-sm font-medium text-red-800">{t('emergency108')}</p><p className="text-lg font-bold text-red-700">108</p></div>
                    </a>
                    <a href={`tel:${hospital.phone || '102'}`} className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center"><Building2 size={16} className="text-blue-700" /></div>
                        <div><p className="text-sm font-medium text-blue-800">{t('hospital')}</p><p className="text-lg font-bold text-blue-700">{hospital.phone || '102'}</p></div>
                    </a>
                    <a href={`tel:${ambulance?.driverPhone || '112'}`} className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 border border-teal-100 hover:bg-teal-100 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-teal-200 flex items-center justify-center"><Truck size={16} className="text-teal-700" /></div>
                        <div><p className="text-sm font-medium text-teal-800">{t('driver')}</p><p className="text-lg font-bold text-teal-700">{ambulance?.driverPhone || '112'}</p></div>
                    </a>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex gap-4">
                <button onClick={() => navigate('/dashboard')} className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-medium text-text-secondary hover:bg-slate-50 transition-colors text-center">
                    {t('backToDashboard')}
                </button>
            </motion.div>
        </motion.div>
    );
}
























