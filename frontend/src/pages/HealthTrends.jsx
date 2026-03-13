import { motion } from 'framer-motion';
import { TrendingUp, Heart, Activity, Thermometer } from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAccessibility } from '../components/AccessibilityProvider';

const weeklyData = [
    { day: 'Mon', heartRate: 72, bpSystolic: 120, bpDiastolic: 80, temp: 36.8, spo2: 98 },
    { day: 'Tue', heartRate: 75, bpSystolic: 118, bpDiastolic: 78, temp: 36.9, spo2: 97 },
    { day: 'Wed', heartRate: 78, bpSystolic: 125, bpDiastolic: 82, temp: 37.1, spo2: 98 },
    { day: 'Thu', heartRate: 71, bpSystolic: 122, bpDiastolic: 80, temp: 36.7, spo2: 99 },
    { day: 'Fri', heartRate: 74, bpSystolic: 119, bpDiastolic: 79, temp: 36.8, spo2: 97 },
    { day: 'Sat', heartRate: 76, bpSystolic: 121, bpDiastolic: 81, temp: 37.0, spo2: 98 },
    { day: 'Sun', heartRate: 73, bpSystolic: 120, bpDiastolic: 80, temp: 36.9, spo2: 98 },
];

const monthlyRisk = [
    { month: 'Jan', risk: 12 }, { month: 'Feb', risk: 15 }, { month: 'Mar', risk: 10 },
    { month: 'Apr', risk: 18 }, { month: 'May', risk: 14 }, { month: 'Jun', risk: 20 },
];

export default function HealthTrends() {
    const { t } = useAccessibility();
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
            <motion.div variants={itemVariants}>
                <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <TrendingUp className="text-primary" size={24} /> {t('healthTrends')}
                </h1>
                <p className="text-text-secondary mt-1">{t('healthTrendsSubtitle')}</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Heart Rate */}
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-2 mb-4">
                        <Heart size={18} className="text-red-500" />
                        <h3 className="font-semibold text-text-primary">{t('heartRate')} (BPM)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={weeklyData}>
                            <defs>
                                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} domain={[60, 90]} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Area type="monotone" dataKey="heartRate" stroke="#EF4444" strokeWidth={2.5} fill="url(#hrGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Blood Pressure */}
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity size={18} className="text-blue-500" />
                        <h3 className="font-semibold text-text-primary">{t('bloodPressure')} (mmHg)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} domain={[60, 140]} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Legend />
                            <Line type="monotone" dataKey="bpSystolic" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB' }} name={t('systolic')} />
                            <Line type="monotone" dataKey="bpDiastolic" stroke="#93C5FD" strokeWidth={2.5} dot={{ fill: '#93C5FD' }} name={t('diastolic')} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Temperature */}
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-2 mb-4">
                        <Thermometer size={18} className="text-yellow-500" />
                        <h3 className="font-semibold text-text-primary">{t('temperature')} (deg C)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={weeklyData}>
                            <defs>
                                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} domain={[36, 38]} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Area type="monotone" dataKey="temp" stroke="#F59E0B" strokeWidth={2.5} fill="url(#tempGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Risk Score Trend */}
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={18} className="text-amber-500" />
                        <h3 className="font-semibold text-text-primary">{t('monthlyRiskScore')}</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyRisk}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                            <Bar dataKey="risk" radius={[6, 6, 0, 0]} fill="#F59E0B" barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>
        </motion.div>
    );
}

