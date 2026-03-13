import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Users, Bed, Truck, AlertTriangle,
    Clock, Bell, X, Siren, MapPin
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../utils/api';
import { getSocket } from '../utils/socket';
import { useAccessibility } from '../components/AccessibilityProvider';

const emergencyTimeline = [
    { time: '06:00', cases: 2 }, { time: '08:00', cases: 5 }, { time: '10:00', cases: 8 },
    { time: '12:00', cases: 6 }, { time: '14:00', cases: 10 }, { time: '16:00', cases: 7 },
    { time: '18:00', cases: 12 }, { time: '20:00', cases: 9 }, { time: '22:00', cases: 4 }
];

export default function HospitalDashboard() {
    const { t, translateEnum } = useAccessibility();
    const [hospitals, setHospitals] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [newAlert, setNewAlert] = useState(null);
    const [showAlert, setShowAlert] = useState(false);

    const fetchData = async () => {
        try {
            const [hospRes, emergRes] = await Promise.all([
                api.get('/hospitals'),
                api.get('/emergency/active').catch(() => ({ data: [] }))
            ]);
            setHospitals(hospRes.data);
            setEmergencies(emergRes.data);
        } catch (err) {
            console.error('Dashboard data fetch error:', err);
        }
    };

    useEffect(() => {
        fetchData();

        const socket = getSocket();

        socket.on('emergency:new', (emergency) => {
            setEmergencies((prev) => [emergency, ...prev]);
            setNewAlert(emergency);
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 15000);
            api.get('/hospitals').then((res) => setHospitals(res.data)).catch(() => { });
        });

        socket.on('emergency:update', (emergency) => {
            setEmergencies((prev) => prev.map((item) => (item._id === emergency._id ? emergency : item)));
        });

        return () => {
            socket.off('emergency:new');
            socket.off('emergency:update');
        };
    }, []);

    const totalDoctors = hospitals.length * 3 || 15;
    const totalICU = hospitals.reduce((sum, item) => sum + (item.icuBedsAvailable || 0), 0) || 32;
    const totalAmbulances = hospitals.reduce((sum, item) => sum + (item.ambulancesAvailable || 0), 0) || 20;

    const bedData = hospitals.length > 0 ? [
        { type: 'ICU', occupied: hospitals.reduce((sum, item) => sum + ((item.icuBedsTotal || 15) - (item.icuBedsAvailable || 0)), 0), available: totalICU },
        { type: 'Emergency', occupied: hospitals.reduce((sum, item) => sum + ((item.emergencyBedsTotal || 30) - (item.emergencyBedsAvailable || 0)), 0), available: hospitals.reduce((sum, item) => sum + (item.emergencyBedsAvailable || 0), 0) },
        { type: 'General', occupied: hospitals.reduce((sum, item) => sum + ((item.generalBedsTotal || 100) - (item.generalBedsAvailable || 0)), 0), available: hospitals.reduce((sum, item) => sum + (item.generalBedsAvailable || 0), 0) }
    ] : [
        { type: 'ICU', occupied: 42, available: 16 },
        { type: 'Emergency', occupied: 78, available: 37 },
        { type: 'General', occupied: 180, available: 90 }
    ];

    const overviewStats = [
        { label: t('totalDoctors'), value: totalDoctors, icon: Users, color: '#2563EB', bg: '#DBEAFE', change: t('hospitalsCount', { count: hospitals.length || 5 }) },
        { label: t('icuBedsAvailable'), value: totalICU, icon: Bed, color: '#14B8A6', bg: '#CCFBF1', change: t('totalLabel', { count: hospitals.reduce((sum, item) => sum + (item.icuBedsTotal || 0), 0) || 58 }) },
        { label: t('ambulancesReady'), value: totalAmbulances, icon: Truck, color: '#F59E0B', bg: '#FEF3C7', change: t('totalFleet', { count: hospitals.reduce((sum, item) => sum + (item.ambulancesTotal || 0), 0) || 30 }) },
        {
            label: t('activeEmergencies'),
            value: emergencies.length,
            icon: AlertTriangle,
            color: '#EF4444',
            bg: '#FEE2E2',
            change: emergencies.length > 0 ? t('latestActive', { name: emergencies[0]?.patientName || t('activeEmergencies') }) : t('noneActive')
        }
    ];

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <AnimatePresence>
                {showAlert && newAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -60, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -60, scale: 0.95 }}
                        className="fixed top-4 left-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2"
                    >
                        <div className="rounded-2xl p-4 text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 animate-pulse">
                                        <Siren size={22} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold">{t('newEmergencyAlert')}</p>
                                        <p className="text-red-100">
                                            <span className="font-semibold text-white">{newAlert.patientName}</span>{' '}
                                            - {newAlert.diagnosis?.prediction} ({t('risk')}: {Math.round((newAlert.diagnosis?.riskScore || 0) * 100)}%)
                                        </p>
                                        <p className="mt-1 text-sm text-red-200">
                                            {t('hospital')}: {newAlert.assignedHospitalName} - {t('doctor')}: {newAlert.assignedDoctorName}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAlert(false)} className="rounded-lg p-1 hover:bg-white/20">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={itemVariants} className="flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
                        <Building2 className="text-primary" size={24} /> {t('hospitalAdminDashboard')}
                    </h1>
                    <p className="mt-1 text-text-secondary">{t('hospitalResourcesOverview')}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-light">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {t('liveUpdatesActive')}
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {overviewStats.map((stat) => (
                    <motion.div key={stat.label} variants={itemVariants} whileHover={{ y: -4 }} className="stat-card">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: stat.bg }}>
                                <stat.icon size={20} style={{ color: stat.color }} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                        <p className="text-sm text-text-secondary">{stat.label}</p>
                        <p className="mt-1 text-xs text-text-light">{stat.change}</p>
                    </motion.div>
                ))}
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <motion.div variants={itemVariants} className="stat-card">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                        <Bed size={18} className="text-teal" /> {t('bedOccupancyLive')}
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={bedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="type" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Legend />
                            <Bar dataKey="occupied" fill="#EF4444" radius={[6, 6, 0, 0]} name={t('occupied')} barSize={25} />
                            <Bar dataKey="available" fill="#10B981" radius={[6, 6, 0, 0]} name={t('available')} barSize={25} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div variants={itemVariants} className="stat-card">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                        <Clock size={18} className="text-emergency" /> {t('emergencyCasesToday')}
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={emergencyTimeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="time" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Line type="monotone" dataKey="cases" stroke="#EF4444" strokeWidth={2.5} dot={{ fill: '#EF4444', r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            <motion.div variants={itemVariants} className="stat-card border-2 border-red-100">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                    <AlertTriangle size={18} className="text-emergency" />
                    {t('activeEmergencies')}
                    {emergencies.length > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{emergencies.length}</span>
                    )}
                </h3>
                {emergencies.length === 0 ? (
                    <div className="py-8 text-center text-text-secondary">
                        <Bell size={32} className="mx-auto mb-2 text-slate-300" />
                        <p>{t('noActiveEmergencies')}</p>
                        <p className="mt-1 text-xs text-text-light">{t('realtimeAlertsAppearHere')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {emergencies.slice(0, 6).map((item, index) => (
                            <motion.div
                                key={item._id || index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="rounded-xl border border-red-100 bg-red-50/30 p-4 transition-colors hover:bg-red-50"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                                            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                                        >
                                            {(item.patientName || 'P')[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{item.patientName || t('patient')}</p>
                                            <p className="text-xs text-text-secondary">
                                                {item.diagnosis?.prediction || t('pending')} - {t('risk')}: {Math.round((item.diagnosis?.riskScore || 0) * 100)}%
                                            </p>
                                            <p className="mt-0.5 text-xs text-text-light">
                                                <MapPin size={10} className="inline" /> {item.assignedHospitalName} - {item.assignedDoctorName}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`risk-badge ${item.diagnosis?.riskLevel === 'Emergency' ? 'risk-emergency' : 'risk-urgent'}`}>
                                            {translateEnum('status', item.diagnosis?.riskLevel || 'emergency')}
                                        </span>
                                        <p className="mt-1.5 text-xs text-text-light">
                                            {item.ambulanceStatus === 'arrived'
                                                ? t('arrivedShort')
                                                : item.ambulanceStatus === 'dispatched'
                                                    ? `${t('eta')}: ${item.estimatedArrival}m`
                                                    : translateEnum('status', item.ambulanceStatus)}
                                        </p>
                                        <p className="text-[10px] text-text-light">
                                            {t('bedType')}: {item.bedType} - {t('ambulance')}: {item.ambulanceVehicle}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>

            <motion.div variants={itemVariants} className="stat-card">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                    <Building2 size={18} className="text-primary" /> {t('hospitalNetworkLiveData')}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-2 py-3 text-left font-medium text-text-secondary">{t('hospital')}</th>
                                <th className="px-2 py-3 text-center font-medium text-text-secondary">ICU</th>
                                <th className="px-2 py-3 text-center font-medium text-text-secondary">Emergency</th>
                                <th className="px-2 py-3 text-center font-medium text-text-secondary">General</th>
                                <th className="px-2 py-3 text-center font-medium text-text-secondary">{t('ambulance')}</th>
                                <th className="px-2 py-3 text-center font-medium text-text-secondary">Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hospitals.map((item, index) => (
                                <tr key={item._id || index} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="px-2 py-3 font-medium">{item.name}</td>
                                    <td className="px-2 py-3 text-center">
                                        <span
                                            className="rounded-lg px-2 py-1 text-xs font-medium"
                                            style={{
                                                background: item.icuBedsAvailable > 5 ? '#D1FAE5' : item.icuBedsAvailable > 0 ? '#FEF3C7' : '#FEE2E2',
                                                color: item.icuBedsAvailable > 5 ? '#065F46' : item.icuBedsAvailable > 0 ? '#92400E' : '#991B1B'
                                            }}
                                        >
                                            {item.icuBedsAvailable}/{item.icuBedsTotal}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 text-center">{item.emergencyBedsAvailable}/{item.emergencyBedsTotal}</td>
                                    <td className="px-2 py-3 text-center">{item.generalBedsAvailable}/{item.generalBedsTotal}</td>
                                    <td className="px-2 py-3 text-center">{item.ambulancesAvailable}/{item.ambulancesTotal}</td>
                                    <td className="px-2 py-3 text-center">
                                        <span className="text-yellow-500">*</span> {item.rating}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
}
