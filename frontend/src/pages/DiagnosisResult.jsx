import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, ChevronRight, Activity, Brain, BarChart3, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../utils/api';
import StatusPopup from '../components/StatusPopup';
import { useAccessibility } from '../components/AccessibilityProvider';

export default function DiagnosisResult() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, translateEnum } = useAccessibility();
    const diagnosis = location.state?.diagnosis;
    const [triggeringEmergency, setTriggeringEmergency] = useState(false);
    const [emergencyError, setEmergencyError] = useState('');
    const [aiExplanation, setAiExplanation] = useState(null);
    const [loadingExplanation, setLoadingExplanation] = useState(false);
    const [smsSent, setSmsSent] = useState(false);
    const [smsFeedback, setSmsFeedback] = useState([]);

    const dismissPopup = (id) => {
        setSmsFeedback(prev => prev.filter(popup => popup.id !== id));
    };

    const showPopups = (items) => {
        const popups = items.map(item => ({ ...item, id: `${Date.now()}-${Math.random()}` }));
        setSmsFeedback(prev => [...prev, ...popups]);
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

    if (!diagnosis) {
        return (
            <div className="text-center py-20">
                <Brain size={60} className="mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-semibold text-text-primary">{t('noDiagnosisData')}</h2>
                <p className="text-text-secondary mt-2">{t('runSymptomCheckFirst')}</p>
                <button onClick={() => navigate('/symptoms')} className="btn-primary mt-4">
                    <Activity size={18} /> {t('startSymptomCheck')}
                </button>
            </div>
        );
    }

    const riskPercent = Math.round((diagnosis.risk_score || 0) * 100);
    const riskLevel = diagnosis.risk_level || 'Routine';
    const riskColor = riskLevel === 'Emergency' ? '#EF4444' : riskLevel === 'Urgent' ? '#F59E0B' : '#10B981';
    const riskBg = riskLevel === 'Emergency' ? '#FEE2E2' : riskLevel === 'Urgent' ? '#FEF3C7' : '#D1FAE5';
    const riskLabel = translateEnum('status', riskLevel);

    const explanationData = (diagnosis.explanation || []).slice(0, 8).map(e => ({
        name: e.feature.replace(/_/g, ' '),
        importance: +(e.importance * 100).toFixed(1),
    }));

    const circumference = 2 * Math.PI * 70;
    const dashOffset = circumference - (circumference * riskPercent / 100);

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

    const sendEmergencySMS = async (patientLocation) => {
        const res = await api.post('/sms/send-emergency', {
            patientLocation,
            diagnosis: {
                prediction: diagnosis.prediction,
                risk_score: diagnosis.risk_score,
                risk_level: diagnosis.risk_level,
                symptoms: diagnosis.symptoms || [],
            }
        });

        if (!res.data.success) {
            const error = new Error(res.data.message || 'Notification delivery failed');
            error.response = { data: res.data };
            throw error;
        }

        setSmsSent(true);
        showPopups(buildChannelPopups(res.data.channels));
    };

    const handleTriggerEmergency = async () => {
        setTriggeringEmergency(true);
        setEmergencyError('');
        setSmsFeedback([]);
        try {
            const patientLocation = await getCurrentLocation();

            const res = await api.post('/emergency/trigger', {
                diagnosis: {
                    prediction: diagnosis.prediction,
                    risk_score: diagnosis.risk_score,
                    riskScore: diagnosis.risk_score,
                    risk_level: diagnosis.risk_level,
                    riskLevel: diagnosis.risk_level,
                    confidence: diagnosis.confidence
                },
                patientLocation
            });

            navigate(`/emergency/${res.data.emergency._id || 'active'}`, {
                state: {
                    emergency: res.data.emergency,
                    hospital: res.data.hospital,
                    doctor: res.data.doctor,
                    ambulance: res.data.ambulance,
                    bedType: res.data.bedType,
                    estimatedArrival: res.data.estimatedArrival,
                    patientLocation
                }
            });
        } catch (err) {
            console.error('Emergency trigger failed:', err);

            const patientLocation = await getCurrentLocation(3000);
            setEmergencyError(t('emergencyApiUnavailableSmsFallback'));

            try {
                await sendEmergencySMS(patientLocation);
            } catch (smsError) {
                setEmergencyError(t('emergencyWorkflowDown'));
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
        } finally {
            setTriggeringEmergency(false);
        }
    };

    const handleDirectSOS = async () => {
        setEmergencyError('');
        setSmsFeedback([]);
        try {
            const patientLocation = await getCurrentLocation();
            await sendEmergencySMS(patientLocation);
        } catch (smsError) {
            setEmergencyError(t('automaticSmsFailed'));
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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    useEffect(() => {
        if (!diagnosis) return;
        setLoadingExplanation(true);
        api.post('/diagnosis/explain', {
            prediction: diagnosis.prediction,
            symptoms: diagnosis.symptoms || [],
            risk_score: diagnosis.risk_score || 0,
            confidence: diagnosis.confidence || 0,
            risk_level: diagnosis.risk_level || 'Routine',
            explanation_data: diagnosis.explanation || []
        }).then(res => setAiExplanation(res.data))
            .catch(() => { })
            .finally(() => setLoadingExplanation(false));
    }, [diagnosis]);

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-4xl mx-auto space-y-6">
            <StatusPopup popups={smsFeedback} onClose={dismissPopup} />

            <motion.div variants={itemVariants} className="text-center">
                <h1 className="text-2xl font-bold text-text-primary">{t('aiDiagnosisResults')}</h1>
                <p className="text-text-secondary mt-1">{t('poweredByMachineLearning')}</p>
            </motion.div>

            <motion.div variants={itemVariants} className="stat-card">
                <div className="flex flex-col md:flex-row items-center gap-8 p-4">
                    <div className="relative">
                        <svg width="180" height="180" viewBox="0 0 180 180">
                            <circle cx="90" cy="90" r="70" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                            <motion.circle
                                cx="90"
                                cy="90"
                                r="70"
                                fill="none"
                                stroke={riskColor}
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: dashOffset }}
                                transition={{ duration: 1.5, ease: 'easeOut' }}
                                transform="rotate(-90 90 90)"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.span
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-4xl font-bold"
                                style={{ color: riskColor }}
                            >
                                {riskPercent}%
                            </motion.span>
                            <span className="text-sm text-text-secondary">{t('riskScore')}</span>
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4" style={{ background: riskBg }}>
                            {riskLevel === 'Emergency' ? <AlertTriangle style={{ color: riskColor }} size={20} /> :
                                <Shield style={{ color: riskColor }} size={20} />}
                            <span className="font-bold text-lg" style={{ color: riskColor }}>{riskLabel}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-text-primary">{diagnosis.prediction}</h2>
                        <p className="text-text-secondary mt-2">
                            {t('confidence')}: <span className="font-semibold">{((diagnosis.confidence || 0) * 100).toFixed(1)}%</span>
                        </p>

                        {(riskLevel === 'Emergency' || riskLevel === 'Urgent') && (
                            <div className="mt-4">
                                <motion.button
                                    whileHover={{ scale: triggeringEmergency ? 1 : 1.05 }}
                                    whileTap={{ scale: triggeringEmergency ? 1 : 0.95 }}
                                    onClick={handleTriggerEmergency}
                                    disabled={triggeringEmergency}
                                    className="btn-emergency disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {triggeringEmergency ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            {t('findingNearestHospital')}
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={20} />
                                            {t('triggerEmergencyResponse')}
                                        </>
                                    )}
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleDirectSOS}
                                    className="flex items-center justify-center gap-2 w-full mt-3 py-3 px-6 rounded-xl font-semibold text-sm transition-all"
                                    style={{
                                        background: smsSent ? '#D1FAE5' : 'linear-gradient(135deg, #1E40AF, #2563EB)',
                                        color: smsSent ? '#065F46' : 'white',
                                        border: smsSent ? '2px solid #6EE7B7' : 'none'
                                    }}
                                >
                                    {smsSent ? t('smsAlertInitiated') : t('sendEmergencySms')}
                                </motion.button>
                                <p className="text-[11px] text-text-light mt-1.5 text-center">
                                    {t('smsBackendNotice')}
                                </p>

                                {emergencyError && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-sm text-amber-700 mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200"
                                    >
                                        {emergencyError}
                                    </motion.p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {explanationData.length > 0 && (
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                            <BarChart3 size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-text-primary">{t('aiExplanation')}</h3>
                            <p className="text-xs text-text-secondary">{t('featureImportancePrediction')}</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={explanationData} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} width={100} />
                            <Tooltip
                                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                formatter={(val) => [`${val}%`, t('importance')]}
                            />
                            <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={20}>
                                {explanationData.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? '#0F766E' : i === 1 ? '#2563EB' : '#94A3B8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            )}

            {aiExplanation && (
                <motion.div variants={itemVariants} className="stat-card border-2 border-blue-100" style={{ background: 'linear-gradient(135deg, #EFF6FF, #F0FDFA)' }}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100">
                            <Brain size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-text-primary">{t('aiMedicalAnalysis')}</h3>
                            <p className="text-xs text-text-secondary">{t('poweredByKnowledgeEngine')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-white/80 border border-slate-100 text-center">
                            <p className="text-xs text-text-light">{t('severity')}</p>
                            <p className="font-bold text-sm" style={{ color: aiExplanation.severity === 'CRITICAL' ? '#DC2626' : aiExplanation.severity === 'HIGH' ? '#F59E0B' : '#10B981' }}>
                                {aiExplanation.severity}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/80 border border-slate-100 text-center">
                            <p className="text-xs text-text-light">{t('department')}</p>
                            <p className="font-bold text-sm text-primary">{aiExplanation.department}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/80 border border-slate-100 text-center">
                            <p className="text-xs text-text-light">{t('urgency')}</p>
                            <p className="font-bold text-xs text-text-primary">{aiExplanation.urgency}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/80 border border-slate-100 text-center">
                            <p className="text-xs text-text-light">{t('condition')}</p>
                            <p className="font-bold text-sm text-text-primary">{aiExplanation.condition}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/80 border border-slate-100 mb-3">
                        <h4 className="font-semibold text-sm text-text-primary mb-2">{t('recommendedAction')}</h4>
                        <p className="text-sm text-text-secondary leading-relaxed">{aiExplanation.recommended_action}</p>
                    </div>

                    {aiExplanation.matching_symptoms && (
                        <div className="flex flex-wrap gap-1.5">
                            {aiExplanation.matching_symptoms.map((s, i) => (
                                <span key={i} className="px-2 py-1 rounded-lg bg-blue-50 text-xs text-primary font-medium">{s}</span>
                            ))}
                        </div>
                    )}

                    <p className="text-[10px] text-text-light mt-3 italic">
                        {t('aiDisclaimer')}
                    </p>
                </motion.div>
            )}

            {loadingExplanation && (
                <motion.div variants={itemVariants} className="stat-card text-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
                    <p className="text-sm text-text-secondary">{t('generatingMedicalAnalysis')}</p>
                </motion.div>
            )}

            {diagnosis.all_probabilities && Object.keys(diagnosis.all_probabilities).length > 0 && (
                <motion.div variants={itemVariants} className="stat-card">
                    <h3 className="font-semibold text-text-primary mb-4">{t('allDiseaseProbabilities')}</h3>
                    <div className="space-y-2">
                        {Object.entries(diagnosis.all_probabilities)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([disease, prob]) => (
                                <div key={disease} className="flex items-center gap-3">
                                    <span className="text-sm text-text-secondary w-36 truncate">{disease}</span>
                                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(prob * 100)}%` }}
                                            transition={{ duration: 1 }}
                                            className="h-full rounded-full"
                                            style={{ background: prob > 0.5 ? '#EF4444' : prob > 0.2 ? '#F59E0B' : '#2563EB' }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{(prob * 100).toFixed(0)}%</span>
                                </div>
                            ))}
                    </div>
                </motion.div>
            )}

            <motion.div variants={itemVariants} className="flex gap-4">
                <button onClick={() => navigate('/symptoms')} className="btn-primary flex-1 justify-center">
                    {t('newCheck')} <ChevronRight size={18} />
                </button>
                <button onClick={() => navigate('/dashboard')} className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-medium text-text-secondary hover:bg-slate-50 transition-colors text-center">
                    {t('backToDashboard')}
                </button>
            </motion.div>
        </motion.div>
    );
}
