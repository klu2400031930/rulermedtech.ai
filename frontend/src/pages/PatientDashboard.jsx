import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
    Heart, Activity, Thermometer, Wind, AlertTriangle,
    Stethoscope, Clock, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import StatusPopup from '../components/StatusPopup';
import { useAccessibility } from '../components/AccessibilityProvider';

const mockVitalsHistory = [
    { date: 'Mon', heartRate: 72, bp: 120, temp: 36.8, spo2: 98 },
    { date: 'Tue', heartRate: 75, bp: 118, temp: 36.9, spo2: 97 },
    { date: 'Wed', heartRate: 78, bp: 125, temp: 37.1, spo2: 98 },
    { date: 'Thu', heartRate: 71, bp: 122, temp: 36.7, spo2: 99 },
    { date: 'Fri', heartRate: 74, bp: 119, temp: 36.8, spo2: 97 },
    { date: 'Sat', heartRate: 76, bp: 121, temp: 37.0, spo2: 98 },
    { date: 'Sun', heartRate: 73, bp: 120, temp: 36.9, spo2: 98 },
];

export default function PatientDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useAccessibility();
    const [recentDiagnosis, setRecentDiagnosis] = useState(null);
    const [sosSent, setSosSent] = useState(false);
    const [sosFeedback, setSosFeedback] = useState([]);

    const dismissPopup = (id) => {
        setSosFeedback(prev => prev.filter(popup => popup.id !== id));
    };

    const showPopups = (items) => {
        const popups = items.map(item => ({ ...item, id: `${Date.now()}-${Math.random()}` }));
        setSosFeedback(prev => [...prev, ...popups]);
        popups.forEach((popup) => {
            setTimeout(() => dismissPopup(popup.id), 5000);
        });
    };

    const buildChannelPopups = (channels) => {
        const items = [];
        if (channels?.sms) {
            items.push(channels.sms.success
                ? {
                    channel: 'sms',
                    tone: 'success',
                    title: t('smsSentSuccessfully'),
                    text: t('smsDeliveredTo', { to: channels.sms.to })
                }
                : {
                    channel: 'sms',
                    tone: 'error',
                    title: t('smsDeliveryFailed'),
                    text: channels.sms.message || t('smsProviderCouldNotDeliver')
                });
        }
        if (channels?.email) {
            items.push(channels.email.success
                ? {
                    channel: 'email',
                    tone: 'success',
                    title: t('emailSentSuccessfully'),
                    text: t('emailDeliveredTo', { to: channels.email.to })
                }
                : {
                    channel: 'email',
                    tone: 'error',
                    title: t('emailDeliveryFailed'),
                    text: channels.email.message || t('emailProviderCouldNotDeliver')
                });
        }
        return items;
    };

    const getCurrentLocation = async (timeout = 5000) => {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout });
            });
            return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
            return { lat: 17.3850, lng: 78.4867 };
        }
    };

    const handleSOSSMS = async () => {
        const patientLocation = await getCurrentLocation();
        setSosFeedback([]);
        try {
            const res = await api.post('/sms/send-emergency', {
                patientLocation,
                diagnosis: {
                    prediction: 'Emergency assistance requested',
                    risk_level: 'Emergency',
                    risk_score: 1
                }
            });

            if (!res.data.success) {
                const error = new Error(res.data.message || 'Notification delivery failed');
                error.response = { data: res.data };
                throw error;
            }

            setSosSent(true);
            showPopups(buildChannelPopups(res.data.channels));
            setTimeout(() => setSosSent(false), 5000);
        } catch (smsError) {
            const channels = smsError.response?.data?.channels;
            if (channels) {
                showPopups(buildChannelPopups(channels));
            } else {
                showPopups([{
                    channel: 'sms',
                    tone: 'error',
                    title: t('automaticDeliveryFailed'),
                    text: smsError.response?.data?.message || t('backendNotificationProvidersFailed')
                }]);
            }
        }
    };

    useEffect(() => {
        api.get('/diagnosis/history').then(res => {
            if (res.data.length > 0) setRecentDiagnosis(res.data[0]);
        }).catch(() => { });
    }, []);

    const stats = [
        { label: t('heartRate'), value: '74', unit: 'BPM', icon: Heart, color: '#EF4444', bg: '#FEE2E2' },
        { label: t('bloodPressure'), value: '120/80', unit: 'mmHg', icon: Activity, color: '#2563EB', bg: '#DBEAFE' },
        { label: t('temperature'), value: '36.9', unit: 'C', icon: Thermometer, color: '#F59E0B', bg: '#FEF3C7' },
        { label: t('spo2'), value: '98', unit: '%', icon: Wind, color: '#14B8A6', bg: '#CCFBF1' },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <StatusPopup popups={sosFeedback} onClose={dismissPopup} />

            <motion.div variants={itemVariants} className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">
                        {t('welcomeBack')} <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
                    </h1>
                    <p className="text-text-secondary mt-1">{t('healthOverviewToday')}</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/symptoms')}
                    className="btn-primary"
                >
                    <Stethoscope size={18} /> {t('checkSymptoms')}
                </motion.button>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    onClick={() => navigate('/symptoms')}
                    className="btn-emergency w-full justify-center"
                >
                    <AlertTriangle size={24} />
                    {t('emergencySosGetHelp')}
                </button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSOSSMS}
                    className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-bold text-sm transition-all"
                    style={{
                        background: sosSent ? '#D1FAE5' : 'linear-gradient(135deg, #1E40AF, #3B82F6)',
                        color: sosSent ? '#065F46' : 'white',
                        border: sosSent ? '2px solid #6EE7B7' : '2px solid transparent'
                    }}
                >
                    {sosSent ? t('smsAlertInitiated') : t('sendEmergencySms')}
                </motion.button>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <motion.div
                        key={stat.label}
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        className="stat-card"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                                <stat.icon size={20} style={{ color: stat.color }} />
                            </div>
                            <span className="text-xs font-medium text-text-light">{t('today')}</span>
                        </div>
                        <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                        <p className="text-sm text-text-secondary">{stat.label} <span className="text-text-light">({stat.unit})</span></p>
                    </motion.div>
                ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={itemVariants} className="lg:col-span-2 stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-text-primary">{t('heartRateTrend')}</h3>
                        <span className="text-xs text-text-light">{t('last7Days')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={mockVitalsHistory}>
                            <defs>
                                <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} domain={[60, 90]} />
                            <Tooltip
                                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                            />
                            <Area type="monotone" dataKey="heartRate" stroke="#EF4444" strokeWidth={2.5} fill="url(#heartGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div variants={itemVariants} className="stat-card">
                    <h3 className="font-semibold text-text-primary mb-4">{t('latestHealthCheck')}</h3>
                    {recentDiagnosis ? (
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl" style={{
                                background: recentDiagnosis.riskLevel === 'Emergency' ? '#FEE2E2' :
                                    recentDiagnosis.riskLevel === 'Urgent' ? '#FEF3C7' : '#D1FAE5'
                            }}>
                                <p className="text-sm font-medium">{recentDiagnosis.prediction}</p>
                                <p className="text-xs mt-1 opacity-75">{t('risk')}: {(recentDiagnosis.riskScore * 100).toFixed(0)}%</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-text-light" />
                                <span className="text-xs text-text-secondary">
                                    {new Date(recentDiagnosis.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <button
                                onClick={() => navigate(`/diagnosis/${recentDiagnosis._id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-50 text-sm font-medium text-primary hover:bg-primary hover:text-white transition-all"
                            >
                                {t('viewDetails')} <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Stethoscope size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-text-secondary">{t('noHealthChecksYet')}</p>
                            <button onClick={() => navigate('/symptoms')}
                                className="mt-3 text-sm text-primary font-medium hover:underline">
                                {t('startFirstCheck')}
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>

            <motion.div variants={itemVariants} className="stat-card">
                <h3 className="font-semibold text-text-primary mb-4">{t('overallHealthStatus')}</h3>
                <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                        <svg className="transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="8"
                                strokeDasharray={`${2 * Math.PI * 40 * 0.85} ${2 * Math.PI * 40}`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-bold text-success">85%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-text-primary">{t('goodHealth')}</p>
                        <p className="text-sm text-text-secondary">{t('vitalsNormal')}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="risk-badge risk-routine">{t('normal')}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
