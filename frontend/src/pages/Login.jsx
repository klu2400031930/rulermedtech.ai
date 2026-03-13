import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Cpu, RefreshCw, Globe, ShieldCheck, Sparkles, Stethoscope, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../components/AccessibilityProvider';

export default function Login() {
    const createCaptcha = () => ({
        first: Math.floor(Math.random() * 9) + 1,
        second: Math.floor(Math.random() * 9) + 1
    });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [captcha, setCaptcha] = useState(createCaptcha);
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { t, settings, updateSetting } = useAccessibility();
    const navigate = useNavigate();

    const resetCaptcha = () => {
        setCaptcha(createCaptcha());
        setCaptchaAnswer('');
    };

    const isCaptchaValid = () => {
        return Number(captchaAnswer) === captcha.first + captcha.second;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrors({});

        if (!isCaptchaValid()) {
            setErrors({ captcha: t('captchaInvalid') });
            resetCaptcha();
            return;
        }

        setLoading(true);

        try {
            const user = await login(email, password);
            switch (user.role) {
                case 'admin':
                    navigate('/admin');
                    break;
                case 'doctor':
                    navigate('/doctor');
                    break;
                default:
                    navigate('/dashboard');
            }
        } catch (err) {
            const message = err.response?.data?.message || t('loginFailed');
            const messageLower = message.toLowerCase();
            if (messageLower.includes('captcha')) {
                setErrors({ captcha: message });
            } else if (messageLower.includes('email') || messageLower.includes('password')) {
                setErrors({ password: message });
            } else {
                setErrors({ form: message });
            }
        } finally {
            setLoading(false);
            resetCaptcha();
        }
    };

    const demoLogin = (role) => {
        const credentials = {
            patient: { email: 'patient@demo.com', password: 'password123' },
            doctor: { email: 'doctor@demo.com', password: 'password123' },
            admin: { email: 'admin@demo.com', password: 'password123' }
        };

        setEmail(credentials[role].email);
        setPassword(credentials[role].password);
    };

    return (
        <div
            className="relative min-h-screen overflow-hidden"
            style={{
                fontFamily: 'var(--font-auth-sans)',
                background: 'linear-gradient(140deg, #F6FBF8 0%, #ECF7F3 45%, #EAF3FA 100%)'
            }}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
                    style={{ background: 'radial-gradient(circle, rgba(15, 118, 110, 0.35), transparent 60%)' }}
                />
                <div
                    className="absolute -bottom-40 right-10 h-96 w-96 rounded-full opacity-20 blur-3xl"
                    style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25), transparent 60%)' }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_40%)]" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
                <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Official Access Portal
                        </div>
                        <div>
                            <h1
                                className="text-4xl font-semibold text-slate-900 sm:text-5xl"
                                style={{ fontFamily: 'var(--font-auth-display)' }}
                            >
                                {t('medaiPlatform')}
                            </h1>
                            <p className="mt-4 max-w-xl text-base text-slate-600">
                                {t('aiPoweredRuralHealthTech')} trusted by hospitals and clinicians to coordinate critical care,
                                triage, and emergency response.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Enterprise-grade security</p>
                                        <p className="mt-1 text-xs text-slate-500">Encrypted workflows and role-based access.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">AI-guided decisions</p>
                                        <p className="mt-1 text-xs text-slate-500">Explainable diagnostics for clarity.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                                        <Stethoscope size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Clinical workflow</p>
                                        <p className="mt-1 text-xs text-slate-500">Unified patient, doctor, and admin views.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                        <Activity size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Live response</p>
                                        <p className="mt-1 text-xs text-slate-500">Real-time ambulance and bed status.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="relative"
                    >
                        <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.12)] backdrop-blur">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Secure Sign In</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t('signInToYourAccount')}</h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20">
                                    <Cpu size={22} />
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('email')}</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                            placeholder={t('enterYourEmail')}
                                            required
                                        />
                                    </div>
                                    {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('password')}</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                            placeholder={t('enterYourPassword')}
                                            required
                                        />
                                    </div>
                                    {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('captcha')}</label>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                                            {t('captchaQuestion', { question: `${captcha.first} + ${captcha.second}` })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetCaptcha}
                                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                                            aria-label={t('refreshCaptcha')}
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={captchaAnswer}
                                        onChange={(event) => setCaptchaAnswer(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                        placeholder={t('captchaAnswer')}
                                        required
                                    />
                                    {errors.captcha && <p className="mt-2 text-xs text-rose-600">{errors.captcha}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-700/20 transition hover:-translate-y-0.5 hover:bg-teal-800"
                                >
                                    {loading ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                                    ) : (
                                        <>
                                            {t('signIn')}
                                            <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                                {errors.form && <p className="text-center text-xs text-rose-600">{errors.form}</p>}
                            </form>

                            <div className="mt-6 rounded-2xl border border-emerald-100/80 bg-emerald-50/80 p-4">
                                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">{t('quickDemoAccess')}</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {['patient', 'doctor', 'admin'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => demoLogin(role)}
                                            className="rounded-lg border border-transparent bg-white px-2 py-2 text-xs font-semibold capitalize text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-slate-900"
                                        >
                                            {t(role)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-3 text-center text-sm text-slate-600">
                                <p>
                                    {t('dontHaveAccount')}{' '}
                                    <Link to="/register" className="font-semibold text-slate-900 hover:underline">
                                        {t('signUp')}
                                    </Link>
                                </p>
                                <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1.5"><Globe size={12} /> {t('language')}</span>
                                    <select
                                        value={settings.language}
                                        onChange={(event) => updateSetting('language', event.target.value)}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                    >
                                        <option value="en">{t('english')}</option>
                                        <option value="hi">{t('hindi')}</option>
                                        <option value="te">{t('telugu')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
