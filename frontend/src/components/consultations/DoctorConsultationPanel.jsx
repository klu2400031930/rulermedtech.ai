import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus2, Clock3, UserRound, Video, Wallet } from 'lucide-react';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import { useAccessibility } from '../AccessibilityProvider';

function getLocalDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function DoctorConsultationPanel() {
    const { t, translateEnum, locale } = useAccessibility();
    const [doctorState, setDoctorState] = useState({ doctor: null, slots: [], bookings: [] });
    const [form, setForm] = useState({
        date: getLocalDateInputValue(),
        slotStartTime: '10:00',
        slotEndTime: '10:30',
        consultationFee: '500',
        notes: ''
    });
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
        if (status === 'confirmed' || status === 'completed') return 'risk-routine';
        if (status === 'payment_completed' || status === 'pending_payment') return 'risk-urgent';
        return 'risk-emergency';
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/consultations/doctor/availability');
            setDoctorState(response.data);
            if (response.data.doctor?.consultationFee) {
                setForm((current) => ({ ...current, consultationFee: String(response.data.doctor.consultationFee) }));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData().catch((error) => {
            setMessage(error.response?.data?.message || t('unableLoadConsultationDashboard'));
        });
    }, []);

    useEffect(() => {
        const socket = getSocket();
        const refresh = () => loadData().catch(() => { });
        socket.on('consultation:slot-updated', refresh);
        socket.on('consultation:booking-updated', refresh);
        return () => {
            socket.off('consultation:slot-updated', refresh);
            socket.off('consultation:booking-updated', refresh);
        };
    }, []);

    const upcomingBookings = useMemo(
        () => doctorState.bookings.filter((booking) => !['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)),
        [doctorState.bookings]
    );
    const historyBookings = useMemo(
        () => doctorState.bookings.filter((booking) => ['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)),
        [doctorState.bookings]
    );

    const handleCreateSlot = async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        try {
            await api.post('/consultations/doctor/availability', {
                ...form,
                consultationFee: Number(form.consultationFee)
            });
            await loadData();
            setMessage(t('availabilitySlotCreated'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableCreateAvailabilitySlot'));
        } finally {
            setBusy(false);
        }
    };

    const handleSlotStatus = async (slotId, status) => {
        setBusy(true);
        setMessage('');
        try {
            await api.put(`/consultations/doctor/availability/${slotId}`, { status });
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableUpdateSlot'));
        } finally {
            setBusy(false);
        }
    };

    const handleStartMeeting = async (bookingId) => {
        setBusy(true);
        setMessage('');
        try {
            const response = await api.post(`/consultations/doctor/bookings/${bookingId}/start`);
            setMessage(t('meetingStarted', { link: response.data.meetingLink }));
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableStartConsultation'));
        } finally {
            setBusy(false);
        }
    };

    const handleCompleteMeeting = async (bookingId) => {
        setBusy(true);
        setMessage('');
        try {
            await api.post(`/consultations/doctor/bookings/${bookingId}/complete`);
            await loadData();
            setMessage(t('consultationMarkedCompleted'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableCompleteConsultation'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="stat-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="mb-1 text-sm font-semibold text-primary">{t('consultationSchedule')}</p>
                        <h2 className="text-2xl font-bold text-text-primary">{doctorState.doctor?.name || t('doctorConsultationDashboard')}</h2>
                        <p className="mt-2 text-text-secondary">{t('manageAvailabilityReviewBooked')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-blue-50 p-4 text-center">
                            <p className="text-xs text-text-light">{t('upcoming')}</p>
                            <p className="text-2xl font-bold text-primary">{upcomingBookings.length}</p>
                        </div>
                        <div className="rounded-2xl bg-teal-50 p-4 text-center">
                            <p className="text-xs text-text-light">{t('slots')}</p>
                            <p className="text-2xl font-bold text-teal">{doctorState.slots.length}</p>
                        </div>
                    </div>
                </div>
                {message && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-primary">{message}</div>}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <form onSubmit={handleCreateSlot} className="stat-card space-y-4">
                    <div className="flex items-center gap-2">
                        <CalendarPlus2 size={18} className="text-primary" />
                        <h3 className="font-semibold text-text-primary">{t('createAvailability')}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-text-secondary">{t('date')}</span>
                            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="input-field" />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-text-secondary">{t('consultationFee')}</span>
                            <input type="number" value={form.consultationFee} onChange={(event) => setForm((current) => ({ ...current, consultationFee: event.target.value }))} className="input-field" />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-text-secondary">{t('start')}</span>
                            <input type="time" value={form.slotStartTime} onChange={(event) => setForm((current) => ({ ...current, slotStartTime: event.target.value }))} className="input-field" />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-text-secondary">{t('end')}</span>
                            <input type="time" value={form.slotEndTime} onChange={(event) => setForm((current) => ({ ...current, slotEndTime: event.target.value }))} className="input-field" />
                        </label>
                    </div>
                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-text-secondary">{t('notes')}</span>
                        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="input-field min-h-24" placeholder={t('optionalNotesForSlot')} />
                    </label>
                    <button type="submit" disabled={busy} className="btn-primary justify-center">
                        <CalendarPlus2 size={16} /> {t('addSlot')}
                    </button>
                </form>

                <div className="stat-card space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock3 size={18} className="text-teal" />
                        <h3 className="font-semibold text-text-primary">{t('availabilityCalendar')}</h3>
                    </div>
                    {loading ? (
                        <div className="py-10 text-center text-text-secondary">{t('loadingAvailability')}</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {doctorState.slots.slice(0, 10).map((slot) => (
                                <div key={slot._id} className="rounded-2xl border border-slate-100 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-semibold text-text-primary">{formatDateTime(slot.startsAt)}</p>
                                            <p className="text-sm text-text-secondary">{slot.slotStartTime} - {slot.slotEndTime}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`risk-badge ${tone(slot.status)}`}>{translateEnum('status', slot.status)}</span>
                                            {slot.status === 'available' && (
                                                <button onClick={() => handleSlotStatus(slot._id, 'cancelled')} type="button" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100">
                                                    {t('cancelSlot')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="stat-card space-y-4">
                <div className="flex items-center gap-2">
                    <UserRound size={18} className="text-primary" />
                    <h3 className="font-semibold text-text-primary">{t('upcomingConsultations')}</h3>
                </div>
                {upcomingBookings.length ? upcomingBookings.map((booking) => (
                    <div key={booking._id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="font-semibold text-text-primary">{booking.patient?.name}</p>
                                <p className="text-sm text-text-secondary">{formatDateTime(booking.consultationDate)}</p>
                                <p className="mt-1 text-sm text-text-secondary">{booking.patient?.email} {booking.patient?.phone ? `| ${booking.patient.phone}` : ''}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className={`risk-badge ${tone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                <span className={`risk-badge ${tone(booking.paymentStatus)}`}>{translateEnum('status', booking.paymentStatus)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-text-light">{t('reason')}</p>
                                <p className="font-semibold text-text-primary">{booking.reason || t('generalFollowup')}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-text-light">{t('meetingLink')}</p>
                                <p className="break-all font-semibold text-text-primary">{booking.meeting?.meetingLink || t('generatedAfterAdminConfirmation')}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-text-light">{t('fee')}</p>
                                <p className="font-semibold text-text-primary"><Wallet size={14} className="mr-1 inline" />{booking.consultationFee}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {booking.bookingStatus === 'confirmed' && (
                                <>
                                    <button onClick={() => handleStartMeeting(booking._id)} disabled={busy} className="btn-primary justify-center">
                                        <Video size={16} /> {t('startConsultation')}
                                    </button>
                                    <button onClick={() => handleCompleteMeeting(booking._id)} disabled={busy} className="rounded-xl bg-green-50 px-4 py-3 font-semibold text-green-700 transition-colors hover:bg-green-100">
                                        {t('markCompleted')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                        {t('noConsultationBookingsYet')}
                    </div>
                )}
            </div>

            <div className="stat-card">
                <div className="mb-4 flex items-center gap-2">
                    <Clock3 size={18} className="text-warning" />
                    <h3 className="font-semibold text-text-primary">{t('consultationHistory')}</h3>
                </div>
                {historyBookings.length ? (
                    <div className="grid grid-cols-1 gap-3">
                        {historyBookings.map((booking) => (
                            <div key={booking._id} className="rounded-2xl border border-slate-100 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-text-primary">{booking.patient?.name}</p>
                                        <p className="text-sm text-text-secondary">{formatDateTime(booking.consultationDate)}</p>
                                    </div>
                                    <span className={`risk-badge ${tone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                        {t('completedConsultationsAppearHere')}
                    </div>
                )}
            </div>
        </motion.section>
    );
}
