import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Mail, Smartphone, Sparkles } from 'lucide-react';

const toneStyles = {
    success: {
        shell: 'from-emerald-500 via-teal-400 to-cyan-400',
        panel: 'bg-white/95 border-emerald-200 text-emerald-950',
        badge: 'bg-emerald-100 text-emerald-700',
        glow: 'shadow-[0_24px_70px_rgba(16,185,129,0.28)]',
        icon: CheckCircle2
    },
    warning: {
        shell: 'from-amber-500 via-orange-400 to-yellow-300',
        panel: 'bg-white/95 border-amber-200 text-amber-950',
        badge: 'bg-amber-100 text-amber-700',
        glow: 'shadow-[0_24px_70px_rgba(245,158,11,0.24)]',
        icon: AlertTriangle
    },
    error: {
        shell: 'from-rose-500 via-red-400 to-orange-400',
        panel: 'bg-white/95 border-rose-200 text-rose-950',
        badge: 'bg-rose-100 text-rose-700',
        glow: 'shadow-[0_24px_70px_rgba(244,63,94,0.24)]',
        icon: XCircle
    }
};

const channelIcons = {
    sms: Smartphone,
    email: Mail
};

export default function StatusPopup({ popups = [], onClose }) {
    return (
        <div className="pointer-events-none fixed top-5 left-1/2 z-[9999] flex w-[min(94vw,34rem)] -translate-x-1/2 flex-col gap-3">
            <AnimatePresence>
                {popups.map((popup, index) => {
                    const config = toneStyles[popup.tone || 'success'];
                    const Icon = config.icon;
                    const ChannelIcon = channelIcons[popup.channel] || Sparkles;

                    return (
                        <motion.div
                            key={popup.id}
                            initial={{ opacity: 0, y: -26, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -18, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                            className="pointer-events-auto"
                            style={{ zIndex: 9999 - index }}
                        >
                            <div className={`rounded-[28px] bg-gradient-to-r p-[1px] ${config.glow} ${config.shell}`}>
                                <div className={`relative overflow-hidden rounded-[27px] border px-4 py-4 backdrop-blur-xl ${config.panel}`}>
                                    <div className="absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8),transparent_70%)] opacity-80" />
                                    <div className="relative flex items-start gap-3">
                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.badge}`}>
                                            <Icon size={22} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${config.badge}`}>
                                                    <ChannelIcon size={12} />
                                                    {popup.channel || 'status'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                    <Sparkles size={12} />
                                                    5 sec
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] opacity-85">
                                                {popup.title}
                                            </p>
                                            <p className="mt-1.5 text-sm leading-6 text-slate-600">
                                                {popup.text}
                                            </p>
                                            <motion.div
                                                initial={{ width: '100%' }}
                                                animate={{ width: '0%' }}
                                                transition={{ duration: 5, ease: 'linear' }}
                                                className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${config.shell}`}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onClose?.(popup.id)}
                                            className="rounded-full bg-slate-100 p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                                            aria-label="Dismiss notification"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
