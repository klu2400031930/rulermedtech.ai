import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Stethoscope, Users, AlertTriangle, Clock, CheckCircle,
    ChevronRight, Activity, Bell, Siren, X, MapPin
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';
import { getSocket } from '../utils/socket';
import { useAccessibility } from '../components/AccessibilityProvider';

const weeklyStats = [
    { day: 'Mon', emergency: 4, urgent: 6, routine: 12 },
    { day: 'Tue', emergency: 3, urgent: 8, routine: 15 },
    { day: 'Wed', emergency: 6, urgent: 5, routine: 10 },
    { day: 'Thu', emergency: 2, urgent: 7, routine: 14 },
    { day: 'Fri', emergency: 5, urgent: 9, routine: 11 },
    { day: 'Sat', emergency: 7, urgent: 4, routine: 8 },
    { day: 'Sun', emergency: 3, urgent: 6, routine: 9 }
];

export default function DoctorDashboard() {
    const { t, translateEnum } = useAccessibility();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [emergencies, setEmergencies] = useState([]);
    const [newAlert, setNewAlert] = useState(null);
    const [showAlert, setShowAlert] = useState(false);

    const fetchEmergencies = async () => {
        try {
            const res = await api.get('/emergency/active');
            setEmergencies(res.data);
        } catch (err) {
            console.error('Failed to fetch emergencies:', err);
        }
    };

    useEffect(() => {
        fetchEmergencies();

        const socket = getSocket();

        socket.on('emergency:new', (emergency) => {
            setEmergencies((prev) => [emergency, ...prev]);
            setNewAlert(emergency);
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 15000);
        });

        socket.on('emergency:update', (emergency) => {
            setEmergencies((prev) => prev.map((item) => (item._id === emergency._id ? emergency : item)));
        });

        return () => {
            socket.off('emergency:new');
            socket.off('emergency:update');
        };
    }, []);

    const formatDoctorName = (name) => {
        if (!name) return t('pending');
        return name.startsWith('Dr.') ? name : `Dr. ${name}`;
    };

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

    const emergencyCount = emergencies.filter((item) => item.diagnosis?.riskLevel === 'Emergency').length;
    const urgentCount = emergencies.filter((item) => item.diagnosis?.riskLevel === 'Urgent').length;

    const stats = [
        { label: t('activeCases'), value: emergencies.length, icon: Users, color: '#2563EB', bg: '#DBEAFE' },
        { label: t('emergencyCases'), value: emergencyCount, icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' },
        { label: t('urgentCases'), value: urgentCount, icon: Clock, color: '#F59E0B', bg: '#FEF3C7' },
        { label: t('resolvedToday'), value: Math.max(0, 12 - emergencies.length), icon: CheckCircle, color: '#10B981', bg: '#D1FAE5' }
    ];

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
                                        <p className="text-lg font-bold">{t('newEmergencyPatient')}</p>
                                        <p className="text-red-100">
                                            <span className="font-semibold text-white">{newAlert.patientName}</span>{' '}
                                            - {newAlert.diagnosis?.prediction} ({t('risk')}: {Math.round((newAlert.diagnosis?.riskScore || 0) * 100)}%)
                                        </p>
                                        <p className="mt-1 text-sm text-red-200">
                                            {t('assigned')}: {formatDoctorName(newAlert.assignedDoctorName)} - {newAlert.bedType} {t('bedType')}
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
                        <Stethoscope className="text-teal" size={24} /> {t('doctorPanelNav')}
                    </h1>
                    <p className="mt-1 text-text-secondary">{t('managePatientsEmergencyCases')}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-light">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {t('liveUpdatesActive')}
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map((stat) => (
                    <motion.div key={stat.label} variants={itemVariants} whileHover={{ y: -4 }} className="stat-card">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: stat.bg }}>
                            <stat.icon size={20} style={{ color: stat.color }} />
                        </div>
                        <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                        <p className="text-sm text-text-secondary">{stat.label}</p>
                    </motion.div>
                ))}
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <motion.div variants={itemVariants} className="stat-card lg:col-span-2">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                        <Users size={18} className="text-primary" /> {t('patientQueueLive')}
                        {emergencies.length > 0 && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-primary">{emergencies.length}</span>
                        )}
                    </h3>

                    {emergencies.length === 0 ? (
                        <div className="py-10 text-center text-text-secondary">
                            <Bell size={40} className="mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">{t('noActivePatients')}</p>
                            <p className="mt-1 text-sm text-text-light">{t('newEmergenciesAppearRealtime')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {emergencies.map((patient, index) => (
                                <motion.div
                                    key={patient._id || index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ x: 4 }}
                                    onClick={() => setSelectedPatient(selectedPatient?._id === patient._id ? null : patient)}
                                    className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedPatient?._id === patient._id ? 'border-primary bg-blue-50/50' : 'border-slate-100 hover:border-primary/20'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                                                style={{
                                                    background: patient.diagnosis?.riskLevel === 'Emergency'
                                                        ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                                        : patient.diagnosis?.riskLevel === 'Urgent'
                                                            ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                                                            : 'linear-gradient(135deg, #10B981, #059669)'
                                                }}
                                            >
                                                {(patient.patientName || 'P')[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{patient.patientName || t('patient')}</p>
                                                <p className="text-xs text-text-secondary">{patient.diagnosis?.prediction || t('pending')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`risk-badge ${patient.diagnosis?.riskLevel === 'Emergency' ? 'risk-emergency' : patient.diagnosis?.riskLevel === 'Urgent' ? 'risk-urgent' : 'risk-routine'}`}>
                                                {translateEnum('status', patient.diagnosis?.riskLevel || 'pending')}
                                            </span>
                                            <span className="text-xs text-text-light">
                                                {patient.createdAt ? new Date(patient.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                            <ChevronRight size={16} className="text-text-light" />
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {selectedPatient?._id === patient._id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-4 border-t border-slate-100 pt-4"
                                            >
                                                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                                                        <p className="text-xs text-text-light">{t('riskScore')}</p>
                                                        <p className="text-sm font-bold text-emergency">{Math.round((patient.diagnosis?.riskScore || 0) * 100)}%</p>
                                                    </div>
                                                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                                                        <p className="text-xs text-text-light">{t('bedType')}</p>
                                                        <p className="text-sm font-bold">{patient.bedType || 'N/A'}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                                                        <p className="text-xs text-text-light">{t('ambulance')}</p>
                                                        <p className="text-sm font-bold">{patient.ambulanceVehicle || 'N/A'}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                                                        <p className="text-xs text-text-light">{t('eta')}</p>
                                                        <p className="text-sm font-bold">{patient.estimatedArrival || '-'} min</p>
                                                    </div>
                                                </div>
                                                <div className="mb-3 text-xs text-text-secondary">
                                                    <p><MapPin size={10} className="inline" /> {t('hospital')}: <span className="font-medium">{patient.assignedHospitalName}</span></p>
                                                    <p>{t('doctor')}: <span className="font-medium">{formatDoctorName(patient.assignedDoctorName)}</span></p>
                                                    <p>{t('status')}: <span className="font-medium capitalize">{translateEnum('status', patient.ambulanceStatus || 'pending')}</span></p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            api.put(`/emergency/${patient._id}/status`, { status: 'in-progress' }).then(() => fetchEmergencies()).catch((err) => console.error(err));
                                                        }}
                                                        className="btn-primary px-3 py-2 text-xs"
                                                    >
                                                        <CheckCircle size={14} /> {t('acceptCase')}
                                                    </button>
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            api.put(`/emergency/${patient._id}/status`, { status: 'resolved', ambulanceStatus: 'arrived' }).then(() => fetchEmergencies()).catch((err) => console.error(err));
                                                        }}
                                                        className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                                                    >
                                                        <CheckCircle size={14} /> {t('markResolved')}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                <motion.div variants={itemVariants} className="stat-card">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary">
                        <Activity size={18} className="text-teal" /> {t('weeklyCases')}
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={weeklyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Legend />
                            <Bar dataKey="emergency" stackId="a" fill="#EF4444" name={t('status_emergency')} />
                            <Bar dataKey="urgent" stackId="a" fill="#F59E0B" name={t('status_urgent')} />
                            <Bar dataKey="routine" stackId="a" fill="#10B981" name={t('status_routine')} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {emergencyCount > 0 && (
                <motion.div variants={itemVariants} className="stat-card border-2 border-red-100">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-emergency">
                        <AlertTriangle size={18} /> {t('criticalEmergencyAlerts')}
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{emergencyCount}</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {emergencies.filter((item) => item.diagnosis?.riskLevel === 'Emergency').map((item, index) => (
                            <div key={item._id || index} className="rounded-xl border border-red-100 bg-red-50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-red-800">{item.patientName}</p>
                                        <p className="text-sm text-red-600">{item.diagnosis?.prediction} - {t('risk')}: {Math.round((item.diagnosis?.riskScore || 0) * 100)}%</p>
                                        <p className="mt-1 text-xs text-red-400">{item.assignedHospitalName} - {formatDoctorName(item.assignedDoctorName)}</p>
                                    </div>
                                    <button
                                        onClick={() => api.put(`/emergency/${item._id}/status`, { status: 'in-progress' }).then(() => fetchEmergencies())}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                    >
                                        {t('respond')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
