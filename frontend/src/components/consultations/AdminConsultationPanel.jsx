import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeIndianRupee, CalendarCheck2, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import { useAccessibility } from '../AccessibilityProvider';

export default function AdminConsultationPanel() {
    const { t, translateEnum, locale } = useAccessibility();
    const [data, setData] = useState({ bookings: [], payments: [] });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const formatDateTime = (value) => {
        if (!value) return t('notScheduled');
        return new Date(value).toLocaleString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const tone = (status) => {
        if (status === 'confirmed' || status === 'completed' || status === 'paid') return 'risk-routine';
        if (status === 'payment_completed' || status === 'pending') return 'risk-urgent';
        return 'risk-emergency';
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/consultations/admin/bookings');
            setData(response.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData().catch((error) => {
            setMessage(error.response?.data?.message || t('unableLoadConsultationBookings'));
        });
    }, []);

    useEffect(() => {
        const socket = getSocket();
        const refresh = () => loadData().catch(() => { });
        socket.on('consultation:booking-updated', refresh);
        socket.on('consultation:slot-updated', refresh);
        return () => {
            socket.off('consultation:booking-updated', refresh);
            socket.off('consultation:slot-updated', refresh);
        };
    }, []);

    const stats = useMemo(() => ([
        { label: t('awaitingReview'), value: data.bookings.filter((booking) => booking.bookingStatus === 'payment_completed').length, icon: ShieldAlert, color: 'text-warning' },
        { label: t('confirmed'), value: data.bookings.filter((booking) => booking.bookingStatus === 'confirmed').length, icon: CalendarCheck2, color: 'text-success' },
        { label: t('paid'), value: data.payments.filter((payment) => payment.paymentStatus === 'paid').length, icon: BadgeIndianRupee, color: 'text-primary' }
    ]), [data, t]);

    const handleConfirm = async (bookingId) => {
        setBusy(true);
        setMessage('');
        try {
            await api.post(`/consultations/admin/bookings/${bookingId}/confirm`);
            await loadData();
            setMessage(t('bookingConfirmedMeetingGenerated'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableConfirmBooking'));
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async (bookingId) => {
        setBusy(true);
        setMessage('');
        try {
            await api.post(`/consultations/admin/bookings/${bookingId}/reject`, { reason: 'Rejected by admin' });
            await loadData();
            setMessage(t('bookingRejected'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableRejectBooking'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="stat-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="mb-1 text-sm font-semibold text-primary">{t('consultationControlCenter')}</p>
                        <h2 className="text-2xl font-bold text-text-primary">{t('reviewBookingsPaymentsReadiness')}</h2>
                        <p className="mt-2 text-text-secondary">{t('confirmPaidRequestsHelp')}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {stats.map((stat) => (
                            <div key={stat.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                                <stat.icon size={18} className={`mx-auto mb-2 ${stat.color}`} />
                                <p className="text-xs text-text-light">{stat.label}</p>
                                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {message && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-primary">{message}</div>}
            </div>

            <div className="stat-card">
                <div className="mb-4 flex items-center gap-2">
                    <CalendarCheck2 size={18} className="text-primary" />
                    <h3 className="font-semibold text-text-primary">{t('consultationBookings')}</h3>
                </div>
                {loading ? (
                    <div className="py-10 text-center text-text-secondary">{t('loadingBookings')}</div>
                ) : data.bookings.length ? (
                    <div className="grid grid-cols-1 gap-4">
                        {data.bookings.map((booking) => (
                            <div key={booking._id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="font-semibold text-text-primary">{booking.patient?.name} with {booking.doctor?.name}</p>
                                        <p className="text-sm text-text-secondary">{formatDateTime(booking.consultationDate)}</p>
                                        <p className="mt-1 text-sm text-text-secondary">{booking.hospital?.name}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`risk-badge ${tone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                        <span className={`risk-badge ${tone(booking.paymentStatus)}`}>{translateEnum('status', booking.paymentStatus)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-text-light">{t('reason')}</p>
                                        <p className="font-semibold text-text-primary">{booking.reason || t('generalConsultation')}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-text-light">{t('meeting')}</p>
                                        <p className="break-all font-semibold text-text-primary">{booking.meeting?.meetingLink || t('createdOnConfirmation')}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-text-light">{t('refundStatus')}</p>
                                        <p className="font-semibold text-text-primary">{booking.refundStatus}</p>
                                    </div>
                                </div>
                                {booking.bookingStatus === 'payment_completed' && (
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => handleConfirm(booking._id)} disabled={busy} className="btn-primary justify-center">
                                            <CheckCircle2 size={16} /> {t('confirmBooking')}
                                        </button>
                                        <button onClick={() => handleReject(booking._id)} disabled={busy} className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700 transition-colors hover:bg-red-100">
                                            <XCircle size={16} className="mr-2 inline" /> {t('reject')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                        {t('consultationRequestsAppearAfterPayment')}
                    </div>
                )}
            </div>

            <div className="stat-card">
                <div className="mb-4 flex items-center gap-2">
                    <BadgeIndianRupee size={18} className="text-warning" />
                    <h3 className="font-semibold text-text-primary">{t('recentPayments')}</h3>
                </div>
                {data.payments.length ? (
                    <div className="grid grid-cols-1 gap-3">
                        {data.payments.map((payment) => (
                            <div key={payment._id} className="rounded-2xl border border-slate-100 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-semibold text-text-primary">{payment.gateway} {t('paymentStatus').toLowerCase()}</p>
                                        <p className="text-sm text-text-secondary">{t('transaction')}: {payment.transactionId || payment.gatewayOrderId || t('pending')}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`risk-badge ${tone(payment.paymentStatus)}`}>{translateEnum('status', payment.paymentStatus)}</span>
                                        <p className="mt-1 text-sm text-text-secondary">{formatDateTime(payment.paymentDate || payment.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                        {t('noPaymentRecordsYet')}
                    </div>
                )}
            </div>
        </motion.section>
    );
}
