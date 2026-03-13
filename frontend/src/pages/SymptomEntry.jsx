import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Stethoscope, Heart, Activity, Thermometer, Wind,
    ChevronRight, ChevronLeft, AlertCircle, CheckCircle2,
    Mic, MicOff, Search, X, Volume2
} from 'lucide-react';
import api from '../utils/api';
import { useAccessibility } from '../components/AccessibilityProvider';
import symptomsData from '../data/symptoms.json';

const SYMPTOMS = symptomsData;
const selectedStyles = { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
const defaultStyles = { bg: '#F8FAFC', text: '#64748B', border: '#F1F5F9' };

export default function SymptomEntry() {
    const navigate = useNavigate();
    const { t, speak } = useAccessibility();
    const [step, setStep] = useState(1);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [vitals, setVitals] = useState({
        heartRate: '', bpSystolic: '', bpDiastolic: '', temperature: '', spo2: '', age: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const vitalFields = [
        { key: 'heartRate', label: t('heartRate'), icon: Heart, unit: 'BPM', placeholder: '75', color: '#B91C1C' },
        { key: 'bpSystolic', label: t('bpSystolic'), icon: Activity, unit: 'mmHg', placeholder: '120', color: '#1D4ED8' },
        { key: 'bpDiastolic', label: t('bpDiastolic'), icon: Activity, unit: 'mmHg', placeholder: '80', color: '#2563EB' },
        { key: 'temperature', label: t('temperature'), icon: Thermometer, unit: 'deg C', placeholder: '37.0', color: '#D97706' },
        { key: 'spo2', label: t('spo2'), icon: Wind, unit: '%', placeholder: '97', color: '#0F766E' },
        { key: 'age', label: t('age'), icon: AlertCircle, unit: t('years'), placeholder: '30', color: '#0F766E' },
    ];

    // Voice input
    const [isListening, setIsListening] = useState(false);
    const [voiceText, setVoiceText] = useState('');
    const [speechSupported, setSpeechSupported] = useState(true);
    const recognitionRef = useRef(null);

    // Free text / autocomplete
    const [freeText, setFreeText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [interpreting, setInterpreting] = useState(false);
    const debounceRef = useRef(null);

    // Check speech API support
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechSupported(false);
        }
    }, []);

    const toggleSymptom = (id) => {
        setSelectedSymptoms(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const getSymptomLabel = (id) => {
        const match = SYMPTOMS.find((item) => item.id === id);
        return match ? match.label : id.replace(/_/g, ' ');
    };

    // ===== VOICE INPUT =====
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceText(t('speechRecognitionNotSupported'));
            return;
        }

        // Stop any existing recognition
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = 'en-IN';

        let finalTranscript = '';

        recognition.onstart = () => {
            setIsListening(true);
            setVoiceText(t('listeningSpeakNow'));
        };

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += text + ' ';
                } else {
                    interim += text;
                }
            }
            setVoiceText(finalTranscript + (interim ? `(${interim}...)` : ''));
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            if (event.error === 'no-speech') {
                setVoiceText(t('noSpeechDetected'));
            } else if (event.error === 'audio-capture') {
                setVoiceText(t('noMicrophoneFound'));
            } else if (event.error === 'not-allowed') {
                setVoiceText(t('microphoneAccessDenied'));
            } else {
                setVoiceText(t('errorTryAgain', { error: event.error }));
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            // If still supposed to be listening, restart (browser may stop)
            if (isListening && recognitionRef.current === recognition) {
                try { recognition.start(); } catch { }
            }
        };

        recognitionRef.current = recognition;
        recognitionRef.current._finalTranscript = '';
        Object.defineProperty(recognitionRef.current, '_getFinal', {
            value: () => finalTranscript,
            writable: true
        });
        recognition.start();
    };

    const stopListening = () => {
        setIsListening(false);
        const recognition = recognitionRef.current;
        if (recognition) {
            // Get accumulated transcript before stopping
            const finalText = recognition._getFinal ? recognition._getFinal() : voiceText;
            try { recognition.stop(); } catch { }
            recognitionRef.current = null;
            // Interpret the collected text
            const cleaned = finalText.replace(/\(.*?\.\.\.\)/g, '').trim();
            if (cleaned) {
                handleVoiceInterpret(cleaned);
            }
        }
    };

    const handleVoiceInterpret = async (text) => {
        if (!text.trim()) return;
        setInterpreting(true);
        try {
            const res = await api.post('/diagnosis/interpret', { text });
            const codes = res.data.symptoms || [];
            setSelectedSymptoms(prev => {
                const combined = new Set([...prev, ...codes]);
                return [...combined];
            });
            const label = codes.length ? codes.map(getSymptomLabel).join(', ') : t('none');
            setVoiceText(`${t('recognizedLabel')}: ${label}`);
        } catch {
            // Fallback: local keyword matching
            const lower = text.toLowerCase();
            const matched = SYMPTOMS.filter((symptom) => {
                const label = symptom.label.toLowerCase();
                return lower.includes(label) || lower.includes(symptom.id.replace(/_/g, ' '));
            }).map(symptom => symptom.id);
            setSelectedSymptoms(prev => [...new Set([...prev, ...matched])]);
            const matchedLabel = matched.length ? matched.map(getSymptomLabel).join(', ') : t('none');
            setVoiceText(matched.length ? `${t('matchedLabel')}: ${matchedLabel}` : t('couldNotRecognizeSymptoms'));
        }
        setInterpreting(false);
    };

    // ===== AUTOCOMPLETE =====
    const handleFreeTextChange = (value) => {
        setFreeText(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (value.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await api.post('/diagnosis/autocomplete', { text: value });
                setSuggestions(res.data.suggestions || []);
                setShowSuggestions(true);
            } catch {
                // Fallback: local filter
                const lower = value.toLowerCase();
                const local = SYMPTOMS.filter((symptom) => {
                    const label = getSymptomLabel(symptom.id).toLowerCase();
                    return label.includes(lower) || symptom.id.includes(lower);
                }).map((symptom) => ({ code: symptom.id, label: getSymptomLabel(symptom.id), score: 1 }));
                setSuggestions(local.slice(0, 6));
                setShowSuggestions(true);
            }
        }, 300);
    };

    const selectSuggestion = (code) => {
        if (!selectedSymptoms.includes(code)) {
            setSelectedSymptoms(prev => [...prev, code]);
        }
        setFreeText('');
        setShowSuggestions(false);
    };

    const interpretFreeText = async () => {
        if (!freeText.trim()) return;
        setInterpreting(true);
        try {
            const res = await api.post('/diagnosis/interpret', { text: freeText });
            const codes = res.data.symptoms || [];
            setSelectedSymptoms(prev => [...new Set([...prev, ...codes])]);
            setFreeText('');
        } catch {
            handleVoiceInterpret(freeText);
        }
        setInterpreting(false);
        setShowSuggestions(false);
    };

    // ===== TEXT TO SPEECH GUIDANCE =====
    const speakGuidance = () => {
        speak(t('voiceGuidanceText'));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/diagnosis', {
                symptoms: selectedSymptoms,
                heartRate: Number(vitals.heartRate) || 75,
                bpSystolic: Number(vitals.bpSystolic) || 120,
                bpDiastolic: Number(vitals.bpDiastolic) || 80,
                temperature: Number(vitals.temperature) || 37.0,
                spo2: Number(vitals.spo2) || 97,
                age: Number(vitals.age) || 30
            });
            navigate(`/diagnosis/${res.data.diagnosisId || res.data._id || 'latest'}`, {
                state: { diagnosis: res.data }
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to get diagnosis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary">{t('stepOf', { step })}</span>
                    <span className="text-sm text-text-light">{step === 1 ? t('selectSymptoms') : step === 2 ? t('enterVitalsStep') : t('reviewAndSubmit')}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #2563EB, #14B8A6)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(step / 3) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* Step 1: Symptoms */}
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="stat-card"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                                    <Stethoscope size={22} className="text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-text-primary">{t('symptomEntryTitle')}</h2>
                                    <p className="text-sm text-text-secondary">{t('selectOrSpeak')}</p>
                                </div>
                            </div>
                            <button onClick={() => speakGuidance()}
                                className="p-2 rounded-lg hover:bg-blue-50 text-primary transition-colors" title={t('voiceGuidance')}>
                                <Volume2 size={18} />
                            </button>
                        </div>

                        {/* Voice + Free Text Input Bar */}
                        <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-100">
                            <div className="flex gap-2 mb-3">
                                {/* Mic Button */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={isListening ? stopListening : startListening}
                                    disabled={!speechSupported}
                                    className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-primary border border-blue-200 hover:bg-blue-50'
                                        } ${!speechSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title={speechSupported ? (isListening ? t('stopListening') : t('speakSymptoms')) : t('speechNotSupportedBrowser')}
                                >
                                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                </motion.button>

                                {/* Free text input with autocomplete */}
                                <div className="flex-1 relative">
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={freeText}
                                            onChange={(e) => handleFreeTextChange(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && interpretFreeText()}
                                            placeholder={t('typeSymptoms')}
                                            className="flex-1 px-4 py-3 rounded-l-xl border border-r-0 border-blue-200 bg-white text-sm focus:outline-none focus:border-primary"
                                        />
                                        <button
                                            onClick={interpretFreeText}
                                            disabled={!freeText.trim() || interpreting}
                                            className="px-4 rounded-r-xl bg-primary text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {interpreting ? '...' : <Search size={16} />}
                                        </button>
                                    </div>

                                    {/* Autocomplete dropdown */}
                                    <AnimatePresence>
                                        {showSuggestions && suggestions.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto"
                                            >
                                                {suggestions.map((s) => (
                                                    <button
                                                        key={s.code}
                                                        onClick={() => selectSuggestion(s.code)}
                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex justify-between items-center ${selectedSymptoms.includes(s.code) ? 'bg-green-50 text-green-700' : ''
                                                            }`}
                                                    >
                                                        <span>{s.label}</span>
                                                        {selectedSymptoms.includes(s.code) ?
                                                            <CheckCircle2 size={14} className="text-green-500" /> :
                                                            <span className="text-xs text-text-light">{Math.round(s.score * 100)}%</span>
                                                        }
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Voice feedback */}
                            {(voiceText || isListening) && (
                                <div className="flex items-center gap-2 text-sm">
                                    {isListening && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                    <span className={isListening ? 'text-red-600' : 'text-green-700'}>
                                        {isListening ? t('listeningSpeakNow') : voiceText}
                                    </span>
                                    {voiceText && !isListening && (
                                        <button onClick={() => setVoiceText('')} className="p-0.5 rounded hover:bg-slate-200">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {!speechSupported && (
                                <p className="text-xs text-amber-600 mt-1">{t('speechNotSupportedBrowser')}</p>
                            )}
                        </div>

                        {/* Symptom Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                            {SYMPTOMS.map((symptom) => {
                                const isSelected = selectedSymptoms.includes(symptom.id);
                                const styles = isSelected ? selectedStyles : defaultStyles;
                                return (
                                    <motion.button
                                        key={symptom.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => toggleSymptom(symptom.id)}
                                        className="p-3 rounded-xl text-left transition-all text-sm font-medium"
                                        style={{
                                            background: styles.bg,
                                            border: `2px solid ${styles.border}`,
                                            color: styles.text
                                        }}
                                    >
                                        <span className="flex items-center gap-2">
                                            {isSelected && <CheckCircle2 size={16} />}
                                            {getSymptomLabel(symptom.id)}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {selectedSymptoms.length > 0 && (
                            <div className="mt-4 p-3 rounded-xl bg-blue-50 text-sm text-primary">
                                {t('symptomsSelected', { count: selectedSymptoms.length })}
                            </div>
                        )}

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => selectedSymptoms.length > 0 && setStep(2)}
                                disabled={selectedSymptoms.length === 0}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('next')} <ChevronRight size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Vitals */}
                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="stat-card"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-50">
                                <Activity size={22} className="text-teal" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">{t('enterVitals')}</h2>
                                <p className="text-sm text-text-secondary">{t('provideReadings')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vitalFields.map(({ key, label, icon: Icon, unit, placeholder, color }) => (
                                <div key={key} className="group">
                                    <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-1.5">
                                        <Icon size={16} style={{ color }} /> {label}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={vitals[key]}
                                            onChange={(e) => setVitals({ ...vitals, [key]: e.target.value })}
                                            className="input-field pr-14"
                                            placeholder={placeholder}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-light">{unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:bg-slate-100 transition-colors">
                                <ChevronLeft size={18} /> {t('back')}
                            </button>
                            <button onClick={() => setStep(3)} className="btn-primary">
                                {t('review')} <ChevronRight size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="stat-card"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                                <CheckCircle2 size={22} className="text-success" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">{t('reviewSubmit')}</h2>
                                <p className="text-sm text-text-secondary">{t('confirmData')}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-text-secondary mb-2">{t('selectedSymptoms')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {selectedSymptoms.map(id => {
                                        const symptom = SYMPTOMS.find(s => s.id === id);
                                        if (!symptom) return null;
                                        const styles = selectedStyles;
                                        return (
                                            <span key={id} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                                style={{ background: styles.bg, color: styles.text, border: `1px solid ${styles.border}` }}>
                                                {getSymptomLabel(symptom.id)}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-text-secondary mb-2">{t('vitals')}</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(vitals).filter(([, v]) => v).map(([key, value]) => {
                                        const field = vitalFields.find((item) => item.key === key);
                                        const label = field?.label || key;
                                        const unit = field?.unit ? ` ${field.unit}` : '';
                                        return (
                                            <div key={key} className="p-2.5 rounded-lg bg-slate-50 text-center">
                                                <p className="text-xs text-text-light">{label}</p>
                                                <p className="text-lg font-bold text-text-primary">{value}{unit}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
                        )}

                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:bg-slate-100 transition-colors">
                                <ChevronLeft size={18} /> {t('back')}
                            </button>
                            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
                                {loading ? (
                                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> {t('analyzing')}</>
                                ) : (
                                    <><Stethoscope size={18} /> {t('getAIDiagnosis')}</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}









