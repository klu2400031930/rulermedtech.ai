import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Building2, Stethoscope, Bell } from 'lucide-react';
import { getSocket } from '../utils/socket';

export default function NotificationToast() {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const socket = getSocket();

        socket.on('sms:notification', (data) => {
            const id = Date.now() + Math.random();
            const notif = { ...data, id };
            setNotifications(prev => [...prev, notif]);

            // Request browser notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            // Send browser push notification
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(data.title || 'MedAI Alert', {
                        body: data.message,
                        icon: '/favicon.ico',
                        tag: `sms-${id}`,
                        requireInteraction: true
                    });
                } catch (e) {
                    // Browser notification not supported
                }
            }

            // Auto-dismiss after 8 seconds
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, 8000);
        });

        return () => {
            socket.off('sms:notification');
        };
    }, []);

    const dismiss = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getIcon = (type) => {
        switch (type) {
            case 'emergency': return <AlertTriangle size={20} className="text-white" />;
            case 'hospital': return <Building2 size={20} className="text-white" />;
            case 'doctor': return <Stethoscope size={20} className="text-white" />;
            default: return <Bell size={20} className="text-white" />;
        }
    };

    const getBg = (type) => {
        switch (type) {
            case 'emergency': return 'linear-gradient(135deg, #DC2626, #EF4444)';
            case 'hospital': return 'linear-gradient(135deg, #2563EB, #3B82F6)';
            case 'doctor': return 'linear-gradient(135deg, #0D9488, #14B8A6)';
            default: return 'linear-gradient(135deg, #6366F1, #818CF8)';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm">
            <AnimatePresence>
                {notifications.map(notif => (
                    <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: 300, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 300, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: getBg(notif.type), minWidth: '320px' }}
                    >
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                                    {getIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-white text-sm">{notif.title}</h4>
                                        <button onClick={() => dismiss(notif.id)}
                                            className="text-white/60 hover:text-white transition-colors p-1">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <p className="text-white/90 text-xs mt-1 leading-relaxed">{notif.message}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-white/50 text-[10px]">
                                            📱 To: {notif.to}
                                        </span>
                                        <span className="text-white/50 text-[10px]">
                                            {new Date(notif.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Progress bar for auto-dismiss */}
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 8, ease: 'linear' }}
                            className="h-1 bg-white/30"
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
