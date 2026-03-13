import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, ArrowRight, Cpu, RefreshCw, Globe, ShieldCheck, Sparkles, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../components/AccessibilityProvider';

export default function Register() {
    const createCaptcha = () => ({
        first: Math.floor(Math.random() * 9) + 1,
        second: Math.floor(Math.random() * 9) + 1
    });
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'patient',
        phone: '',
        specialization: '',
        consultationFee: '500',
        hospitalName: ''
    });
    const [captcha, setCaptcha] = useState(createCaptcha);
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const { t, settings, updateSetting } = useAccessibility();
    const navigate = useNavigate();

    const passwordChecks = {
        length: form.password.length >= 9,
        upper: /[A-Z]/.test(form.password),
        lower: /[a-z]/.test(form.password),
        number: /\d/.test(form.password),
        special: /[^A-Za-z0-9]/.test(form.password)
    };
    const isPasswordValid = Object.values(passwordChecks).every(Boolean);
    const passwordsMatch = form.password && form.confirmPassword && form.password === form.confirmPassword;

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

        const nextErrors = {};
        if (!isPasswordValid) nextErrors.password = t('passwordDoesNotMeetRequirements');
        if (!passwordsMatch) nextErrors.confirmPassword = t('passwordsDoNotMatch');
        if (!isCaptchaValid()) nextErrors.captcha = t('captchaInvalid');

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            if (nextErrors.captcha) resetCaptcha();
            return;
        }

        setLoading(true);

        try {
            const user = await register(form);
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
            const message = err.response?.data?.message || t('registrationFailed');
            const messageLower = message.toLowerCase();
            if (messageLower.includes('exists')) {
                setErrors({ email: message });
            } else if (messageLower.includes('password')) {
                setErrors({ password: message });
            } else if (messageLower.includes('captcha')) {
                setErrors({ captcha: message });
            } else {
                setErrors({ form: message });
            }
        } finally {
            setLoading(false);
            resetCaptcha();
        }
    };

    return (
        <div
            className="relative min-h-screen overflow-hidden"
            style={{
                fontFamily: 'var(--font-auth-sans)',
                background: 'linear-gradient(145deg, #F6FBF8 0%, #EAF4FA 50%, #F2FBF7 100%)'
            }}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute -top-40 left-16 h-80 w-80 rounded-full opacity-30 blur-3xl"
                    style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.22), transparent 60%)' }}
                />
                <div
                    className="absolute -bottom-40 right-10 h-96 w-96 rounded-full opacity-20 blur-3xl"
                    style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3), transparent 60%)' }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_40%)]" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
                <div className="grid w-full items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Onboard in minutes
                        </div>
                        <div>
                            <h1
                                className="text-4xl font-semibold text-slate-900 sm:text-5xl"
                                style={{ fontFamily: 'var(--font-auth-display)' }}
                            >
                                {t('createAccount')}
                            </h1>
                            <p className="mt-4 max-w-xl text-base text-slate-600">
                                {t('joinPlatform')} with secure credentials, verified roles, and a guided setup.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Verified access control</p>
                                        <p className="mt-1 text-xs text-slate-500">Select patient, doctor, or admin roles with proper routing.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                        <HeartPulse size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">Care-first workflow</p>
                                        <p className="mt-1 text-xs text-slate-500">Start with smart triage and emergency coordination.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">AI-ready profile</p>
                                        <p className="mt-1 text-xs text-slate-500">Personalized recommendations after first login.</p>
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
                                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Account Setup</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t('createAccount')}</h2>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20">
                                    <Cpu size={22} />
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('fullName')}</label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={(event) => setForm({ ...form, name: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder={t('yourFullName')}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('email')}</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="email"
                                                value={form.email}
                                                onChange={(event) => setForm({ ...form, email: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder="your@email.com"
                                                required
                                            />
                                        </div>
                                        {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('password')}</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="password"
                                                value={form.password}
                                                onChange={(event) => setForm({ ...form, password: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder={t('minSixCharacters')}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                        {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('confirmPassword')}</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="password"
                                                value={form.confirmPassword}
                                                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder={t('reenterPassword')}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                        {form.confirmPassword && (
                                            <p className={`mt-1 text-xs ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {passwordsMatch ? t('passwordsMatch') : t('passwordsDoNotMatch')}
                                            </p>
                                        )}
                                        {errors.confirmPassword && <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword}</p>}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-slate-600">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{t('passwordRequirements')}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <p className={`flex items-center gap-2 ${passwordChecks.length ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <CheckCircle2 size={14} /> {t('passwordRequirementLength')}
                                        </p>
                                        <p className={`flex items-center gap-2 ${passwordChecks.upper ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <CheckCircle2 size={14} /> {t('passwordRequirementUpper')}
                                        </p>
                                        <p className={`flex items-center gap-2 ${passwordChecks.lower ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <CheckCircle2 size={14} /> {t('passwordRequirementLower')}
                                        </p>
                                        <p className={`flex items-center gap-2 ${passwordChecks.number ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <CheckCircle2 size={14} /> {t('passwordRequirementNumber')}
                                        </p>
                                        <p className={`flex items-center gap-2 ${passwordChecks.special ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <CheckCircle2 size={14} /> {t('passwordRequirementSpecial')}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('phone')}</label>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-10 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder="+91-9876543210"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('role')}</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['patient', 'doctor', 'admin'].map((role) => (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, role })}
                                                    className={`rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition ${form.role === role ? 'border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-700/15' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-slate-900'}`}
                                                >
                                                    {t(role)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {form.role === 'doctor' && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('specialization')}</label>
                                            <input
                                                type="text"
                                                value={form.specialization}
                                                onChange={(event) => setForm({ ...form, specialization: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder="General Medicine"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('consultationFee')}</label>
                                            <input
                                                type="number"
                                                value={form.consultationFee}
                                                onChange={(event) => setForm({ ...form, consultationFee: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder="500"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('hospitalPracticeName')}</label>
                                            <input
                                                type="text"
                                                value={form.hospitalName}
                                                onChange={(event) => setForm({ ...form, hospitalName: event.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15"
                                                placeholder={t('independentOnlinePractice')}
                                            />
                                        </div>
                                    </div>
                                )}

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
                                            {t('createAccount')}
                                            <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                                {errors.form && <p className="text-center text-xs text-rose-600">{errors.form}</p>}
                            </form>

                            <div className="mt-6 flex flex-col gap-3 text-center text-sm text-slate-600">
                                <p>
                                    {t('alreadyHaveAccount')}{' '}
                                    <Link to="/login" className="font-semibold text-slate-900 hover:underline">
                                        {t('signIn')}
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
