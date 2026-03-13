import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Stethoscope, Activity, TrendingUp, Heart, Building2, MessageCircle,
    LogOut, Menu, X, Cpu, Volume2, Eye, Phone, Globe, Video, UserRound, Settings
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from './AccessibilityProvider';
import ChatbotWidget from './ChatbotWidget';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { settings, updateSetting, isOnline, t } = useAccessibility();

    const patientLinks = [
        { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
        { to: '/symptoms', icon: Stethoscope, label: t('symptomCheck') },
        { to: '/consultations', icon: Video, label: t('patientAppointmentsNav') },
        { to: '/health-trends', icon: TrendingUp, label: t('healthTrends') },
        { to: '/visualization', icon: Heart, label: t('healthView') },
        { to: '/profile', icon: UserRound, label: t('profile') },
        { to: '/chatbot', icon: MessageCircle, label: t('chatbot') }
    ];

    const adminLinks = [
        { to: '/admin', icon: Building2, label: t('hospitalDashboardNav') },
        { to: '/admin/consultations', icon: Video, label: t('patientAppointmentsNav') },
        { to: '/profile', icon: UserRound, label: t('profile') }
    ];

    const doctorLinks = [
        { to: '/doctor', icon: Activity, label: t('doctorPanelNav') },
        { to: '/doctor/consultations', icon: Video, label: t('doctorConsultationsNav') },
        { to: '/profile', icon: UserRound, label: t('profile') }
    ];

    const links = user?.role === 'admin' ? adminLinks : user?.role === 'doctor' ? doctorLinks : patientLinks;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen">
            <motion.aside
                initial={{ x: -280 }}
                animate={{ x: sidebarOpen ? 0 : -280 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed top-0 left-0 z-40 h-full w-[280px] flex flex-col"
                style={{
                    background: 'linear-gradient(180deg, #E6F4F1 0%, #DCE9F7 100%)',
                    borderRight: '1px solid #C7D7E2'
                }}
            >
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="mb-8 flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{ background: 'linear-gradient(135deg, #0F766E, #2563EB)' }}
                        >
                            <Cpu size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">MedAI</h1>
                            <p className="text-xs text-slate-500">{t('ruralHealthTech')}</p>
                        </div>
                    </div>

                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Navigation</p>
                    <nav className="flex flex-col gap-1 pb-6">
                        {links.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="border-t border-slate-200 p-6">
                    <div className="space-y-3">
                        <button
                            onClick={() => setSettingsOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <span className="flex items-center gap-2">
                                <Settings size={12} />
                                {t('accessibility')}
                            </span>
                            <span className="text-[10px] text-slate-400">{settingsOpen ? 'Hide' : 'Open'}</span>
                        </button>

                        {settingsOpen && (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 space-y-3">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                    <div
                                        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                                        style={{ background: 'linear-gradient(135deg, #0F766E, #2563EB)' }}
                                    >
                                        {user?.name?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                                        <p className="text-xs capitalize text-slate-500">{t(user?.role || 'patient')}</p>
                                    </div>
                                </div>

                                <label className="flex cursor-pointer items-center justify-between text-xs text-slate-600">
                                    <span className="flex items-center gap-1.5"><Eye size={12} /> {t('lowBandwidth')}</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.lowBandwidth}
                                        onChange={(event) => updateSetting('lowBandwidth', event.target.checked)}
                                        className="h-3.5 w-3.5 accent-teal-600"
                                    />
                                </label>
                                <label className="flex cursor-pointer items-center justify-between text-xs text-slate-600">
                                    <span className="flex items-center gap-1.5"><Volume2 size={12} /> {t('voiceGuide')}</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.voiceGuidance}
                                        onChange={(event) => updateSetting('voiceGuidance', event.target.checked)}
                                        className="h-3.5 w-3.5 accent-teal-600"
                                    />
                                </label>
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span className="flex items-center gap-1.5"><Globe size={12} /> {t('language')}</span>
                                    <select
                                        value={settings.language}
                                        onChange={(event) => updateSetting('language', event.target.value)}
                                        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-700"
                                    >
                                        <option value="en">{t('english')}</option>
                                        <option value="hi">{t('hindi')}</option>
                                        <option value="te">{t('telugu')}</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <LogOut size={14} /> {t('signOut')}
                                    </span>
                                </button>
                            </div>
                        )}

                        <a
                            href="tel:108"
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700"
                        >
                            <Phone size={12} /> {t('emergency108')}
                        </a>
                    </div>
                </div>
            </motion.aside>

            <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-[280px]' : 'ml-0'}`}>
                <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl">
                    <div className="flex items-center justify-between px-6 py-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                        >
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className={`text-xs font-medium ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
                                    {isOnline ? t('online') : t('offline')}
                                </span>
                            </div>
                            <a
                                href="tel:108"
                                className="hidden items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 sm:flex"
                            >
                                <Phone size={14} /> {t('emergency108')}
                            </a>
                        </div>
                    </div>
                </header>

                <main className="p-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            {user?.role === 'patient' && <ChatbotWidget />}
        </div>
    );
}
