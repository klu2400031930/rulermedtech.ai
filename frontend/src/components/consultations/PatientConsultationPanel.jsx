import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    CalendarDays,
    Clock3,
    Filter,
    Hospital,
    IndianRupee,
    Search,
    ShieldCheck,
    Star,
    Stethoscope,
    Video,
    Wallet,
    XCircle
} from 'lucide-react';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import { useAccessibility } from '../AccessibilityProvider';

function getLocalDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalDateFromValue(value) {
    return value ? getLocalDateInputValue(new Date(value)) : getLocalDateInputValue();
}

const currency = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
});

function formatDateTime(value) {
    if (!value) return 'Not scheduled';
    return new Date(value).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function statusTone(status) {
    if (status === 'confirmed' || status === 'completed' || status === 'paid') return 'risk-routine';
    if (status === 'payment_completed' || status === 'pending') return 'risk-urgent';
    if (status === 'cancelled' || status === 'rejected' || status === 'failed') return 'risk-emergency';
    return 'risk-urgent';
}

function PaymentStep({ checkout, gateway, onGatewayChange, onCreateOrder, onCompletePayment, onClose, busy, t, translateEnum, formatDateTimeLocal }) {
    if (!checkout) return null;

    const isPaid = checkout.paymentStatus === 'paid';
    const liveGatewayNotice = checkout.order && checkout.order.gateway !== 'simulated';

    return (
        <div className="stat-card space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-text-primary">{t('checkout')}</p>
                    <p className="text-sm text-text-secondary">
                        {t('bookingForDoctor', { id: checkout._id?.slice(-6), doctor: checkout.doctor?.name || '' })}
                    </p>
                </div>
                <button onClick={onClose} className="text-text-light hover:text-text-primary transition-colors">
                    <XCircle size={18} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-text-light">{t('consultationFee')}</p>
                    <p className="text-lg font-semibold text-text-primary">{currency.format(checkout.consultationFee || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-text-light">{t('consultationTime')}</p>
                    <p className="text-sm font-semibold text-text-primary">{formatDateTimeLocal(checkout.consultationDate)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-text-light">{t('bookingStatus')}</p>
                    <span className={`risk-badge ${statusTone(checkout.bookingStatus)}`}>{translateEnum('status', checkout.bookingStatus)}</span>
                </div>
            </div>

            {!isPaid && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
                    <label className="block">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('paymentGateway')}</span>
                        <select value={gateway} onChange={(event) => onGatewayChange(event.target.value)} className="input-field">
                            <option value="simulated">{t('simulatedGateway')}</option>
                            <option value="razorpay">Razorpay</option>
                            <option value="stripe">Stripe</option>
                        </select>
                    </label>
                    <button onClick={onCreateOrder} disabled={busy} className="btn-primary justify-center">
                        <Wallet size={16} /> {checkout.order ? t('refreshOrder') : t('createPaymentOrder')}
                    </button>
                </div>
            )}

            {checkout.order && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-2">
                    <p className="text-sm font-semibold text-primary">{t('orderReady')}</p>
                    <p className="text-sm text-text-secondary">{t('gateway')}: <span className="font-medium text-text-primary">{checkout.order.gateway}</span></p>
                    <p className="text-sm text-text-secondary">{t('orderId')}: <span className="font-medium text-text-primary">{checkout.order.orderId}</span></p>
                    {liveGatewayNotice ? (
                        <p className="text-sm text-text-secondary">{t('liveGatewayNotice')}</p>
                    ) : (
                        <div className="flex flex-wrap gap-3 pt-2">
                            <button onClick={() => onCompletePayment(true)} disabled={busy} className="btn-primary justify-center">
                                <ShieldCheck size={16} /> {t('simulateSuccess')}
                            </button>
                            <button
                                onClick={() => onCompletePayment(false)}
                                disabled={busy}
                                className="px-4 py-3 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors"
                            >
                                {t('simulateFailure')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PatientConsultationPanel() {
    const { t, translateEnum, locale } = useAccessibility();
    const [meta, setMeta] = useState({ specializations: [], hospitals: [] });
    const [filters, setFilters] = useState({
        search: '',
        specialization: '',
        hospital: '',
        location: '',
        minRating: '0',
        maxFee: '2500'
    });
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedDate, setSelectedDate] = useState(getLocalDateInputValue());
    const [doctorDetail, setDoctorDetail] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [busyAction, setBusyAction] = useState(false);
    const [gateway, setGateway] = useState('simulated');
    const [reason, setReason] = useState('');
    const [checkoutBooking, setCheckoutBooking] = useState(null);
    const [message, setMessage] = useState('');
    const [reviewDrafts, setReviewDrafts] = useState({});

    const formatDateTimeLocal = (value) => {
        if (!value) return t('notScheduled');
        return new Date(value).toLocaleString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const selectDoctor = (doctor) => {
        setSelectedDoctorId(doctor?._id || '');
        if (doctor?.nextAvailableSlot) {
            setSelectedDate(getLocalDateFromValue(doctor.nextAvailableSlot));
        }
    };

    const refreshBookings = async () => {
        const response = await api.get('/consultations/patient/bookings');
        setBookings(response.data);
    };

    const loadDoctors = async () => {
        setLoadingDoctors(true);
        try {
            const response = await api.get('/consultations/doctors', { params: filters });
            setDoctors(response.data);
            if (!selectedDoctorId && response.data.length > 0) {
                selectDoctor(response.data[0]);
            }
            if (selectedDoctorId && !response.data.some((doctor) => doctor._id === selectedDoctorId)) {
                selectDoctor(response.data[0]);
            }
        } finally {
            setLoadingDoctors(false);
        }
    };

    const loadDoctorDetail = async (doctorId, date) => {
        if (!doctorId) {
            setDoctorDetail(null);
            return;
        }
        setLoadingDetail(true);
        try {
            const response = await api.get(`/consultations/doctors/${doctorId}`, { params: { date } });
            setDoctorDetail(response.data);
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => {
        Promise.all([
            api.get('/consultations/meta'),
            refreshBookings()
        ]).then(([metaResponse]) => {
            setMeta(metaResponse.data);
        }).catch(() => {
            setMessage(t('unableLoadConsultationData'));
        });
    }, []);

    useEffect(() => {
        loadDoctors().catch((error) => {
            setMessage(error.response?.data?.message || t('unableLoadDoctors'));
        });
    }, [filters.search, filters.specialization, filters.hospital, filters.location, filters.minRating, filters.maxFee]);

    useEffect(() => {
        loadDoctorDetail(selectedDoctorId, selectedDate).catch((error) => {
            setMessage(error.response?.data?.message || t('unableLoadDoctorDetails'));
        });
    }, [selectedDoctorId, selectedDate]);

    useEffect(() => {
        const socket = getSocket();
        const onSlotUpdate = (payload) => {
            if (payload.doctorId === selectedDoctorId) {
                loadDoctorDetail(selectedDoctorId, selectedDate).catch(() => { });
            }
        };
        const onBookingUpdate = () => {
            refreshBookings().catch(() => { });
        };
        socket.on('consultation:slot-updated', onSlotUpdate);
        socket.on('consultation:booking-updated', onBookingUpdate);
        return () => {
            socket.off('consultation:slot-updated', onSlotUpdate);
            socket.off('consultation:booking-updated', onBookingUpdate);
        };
    }, [selectedDate, selectedDoctorId]);

    const upcomingBookings = useMemo(
        () => bookings.filter((booking) => !['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)),
        [bookings]
    );
    const historyBookings = useMemo(
        () => bookings.filter((booking) => ['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus)),
        [bookings]
    );

    const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId);
    const selectedSlotIdsForReschedule = useMemo(
        () => new Set((doctorDetail?.availableSlots || []).map((slot) => slot._id)),
        [doctorDetail]
    );
    const slotsToDisplay = doctorDetail?.availableSlots?.length
        ? doctorDetail.availableSlots
        : (doctorDetail?.upcomingSlots || []);

    const handleSlotHold = async (slotId) => {
        setBusyAction(true);
        setMessage('');
        try {
            const response = await api.post('/consultations/bookings/hold', {
                doctorId: selectedDoctorId,
                slotId,
                reason
            });
            setCheckoutBooking(response.data.booking);
            await refreshBookings();
            await loadDoctorDetail(selectedDoctorId, selectedDate);
            setMessage(t('slotLockedSuccess'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableHoldSlot'));
        } finally {
            setBusyAction(false);
        }
    };

    const handleCreateOrder = async () => {
        if (!checkoutBooking) return;
        setBusyAction(true);
        setMessage('');
        try {
            const response = await api.post(`/consultations/bookings/${checkoutBooking._id}/payment-order`, { gateway });
            setCheckoutBooking((current) => ({ ...current, order: response.data.order }));
            setMessage(t('paymentOrderCreated'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableCreatePaymentOrder'));
        } finally {
            setBusyAction(false);
        }
    };

    const handleCompletePayment = async (success) => {
        if (!checkoutBooking) return;
        setBusyAction(true);
        setMessage('');
        try {
            const response = await api.post(`/consultations/bookings/${checkoutBooking._id}/complete-payment`, success
                ? { transactionId: `UI-${Date.now()}` }
                : { forceFailure: true, reason: 'Simulated payment failure from dashboard' }
            );
            setCheckoutBooking(response.data.booking);
            await refreshBookings();
            await loadDoctorDetail(selectedDoctorId, selectedDate);
            setMessage(success ? t('paymentCompletedAwaitingAdmin') : t('paymentFailedReleased'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('paymentVerificationFailed'));
        } finally {
            setBusyAction(false);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        setBusyAction(true);
        setMessage('');
        try {
            await api.post(`/consultations/bookings/${bookingId}/cancel`, { reason: 'Cancelled by patient from dashboard' });
            await refreshBookings();
            await loadDoctorDetail(selectedDoctorId, selectedDate);
            setCheckoutBooking((current) => (current?._id === bookingId ? null : current));
            setMessage(t('bookingCancelledSuccess'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableCancelBooking'));
        } finally {
            setBusyAction(false);
        }
    };

    const handleReschedule = async (bookingId, doctorId) => {
        if (!selectedDoctorId || doctorId !== selectedDoctorId || !doctorDetail?.availableSlots?.[0]) {
            setMessage(t('selectSameDoctorReschedule'));
            return;
        }

        const slotId = doctorDetail.availableSlots[0]._id;
        setBusyAction(true);
        setMessage('');
        try {
            await api.post(`/consultations/bookings/${bookingId}/reschedule`, { slotId });
            await refreshBookings();
            await loadDoctorDetail(selectedDoctorId, selectedDate);
            setMessage(t('consultationRescheduled'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableRescheduleBooking'));
        } finally {
            setBusyAction(false);
        }
    };

    const handleReviewSubmit = async (bookingId) => {
        const review = reviewDrafts[bookingId];
        if (!review?.rating) {
            setMessage(t('selectRatingBeforeFeedback'));
            return;
        }

        setBusyAction(true);
        setMessage('');
        try {
            await api.post(`/consultations/bookings/${bookingId}/review`, review);
            await loadDoctors();
            await refreshBookings();
            setReviewDrafts((current) => ({ ...current, [bookingId]: { rating: '', comment: '' } }));
            setMessage(t('thanksForFeedback'));
        } catch (error) {
            setMessage(error.response?.data?.message || t('unableSubmitReview'));
        } finally {
            setBusyAction(false);
        }
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="stat-card">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-primary mb-1">{t('onlineConsultation')}</p>
                        <h2 className="text-2xl font-bold text-text-primary">{t('bookDoctorPayReceive')}</h2>
                        <p className="text-text-secondary mt-2">{t('searchDoctorsSummary')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:w-auto">
                        <div className="rounded-2xl bg-blue-50 p-4 text-center">
                            <p className="text-xs text-text-light">{t('doctors')}</p>
                            <p className="text-2xl font-bold text-primary">{doctors.length}</p>
                        </div>
                        <div className="rounded-2xl bg-teal-50 p-4 text-center">
                            <p className="text-xs text-text-light">{t('myConsultations')}</p>
                            <p className="text-2xl font-bold text-teal">{bookings.length}</p>
                        </div>
                    </div>
                </div>
                {message && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-primary">
                        {message}
                    </div>
                )}
            </div>

            <div className="stat-card space-y-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-primary" />
                    <h3 className="font-semibold text-text-primary">{t('doctorSearchFilters')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                    <label className="block xl:col-span-2">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('search')}</span>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
                            <input
                                value={filters.search}
                                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                                className="input-field pl-10"
                                placeholder={t('searchDoctorSpecialtyHospital')}
                            />
                        </div>
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('specialization')}</span>
                        <select
                            value={filters.specialization}
                            onChange={(event) => setFilters((current) => ({ ...current, specialization: event.target.value }))}
                            className="input-field"
                        >
                            <option value="">{t('allSpecializations')}</option>
                            {meta.specializations.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('hospital')}</span>
                        <input
                            value={filters.hospital}
                            onChange={(event) => setFilters((current) => ({ ...current, hospital: event.target.value }))}
                            className="input-field"
                            placeholder={t('hospitalPracticeName')}
                        />
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('location')}</span>
                        <input
                            value={filters.location}
                            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                            className="input-field"
                            placeholder="City or district"
                        />
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-text-secondary mb-2">{t('upToFee')}</span>
                        <input
                            type="number"
                            min="100"
                            value={filters.maxFee}
                            onChange={(event) => setFilters((current) => ({ ...current, maxFee: event.target.value }))}
                            className="input-field"
                        />
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
                <div className="space-y-4">
                    <div className="stat-card">
                        <div className="flex items-center gap-2 mb-4">
                            <Stethoscope size={18} className="text-primary" />
                            <h3 className="font-semibold text-text-primary">Doctors available for online consultation</h3>
                        </div>
                        {loadingDoctors ? (
                            <div className="py-12 text-center text-text-secondary">Loading doctor directory...</div>
                        ) : !doctors.length ? (
                            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                                No doctors are available for booking yet. Doctors will appear here after they log in and create consultation slots from their dashboard.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {doctors.map((doctor) => (
                                    <button
                                        key={doctor._id}
                                        type="button"
                                        onClick={() => selectDoctor(doctor)}
                                        className={`text-left rounded-2xl border p-4 transition-all ${
                                            selectedDoctorId === doctor._id
                                                ? 'border-primary bg-blue-50/60 shadow-lg'
                                                : 'border-slate-100 hover:border-primary/30 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                            <div>
                                                <p className="text-lg font-semibold text-text-primary">{doctor.name}</p>
                                                <p className="text-sm text-text-secondary">{doctor.specialization}</p>
                                                <p className="text-sm text-text-secondary mt-1">{doctor.hospitalDetails?.hospitalName || doctor.hospitalName}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="risk-badge risk-routine flex items-center gap-1">
                                                    <Star size={12} /> {doctor.rating}
                                                </span>
                                                <span className="risk-badge risk-urgent flex items-center gap-1">
                                                    <IndianRupee size={12} /> {doctor.consultationFee}
                                                </span>
                                                <span className="risk-badge risk-routine">{doctor.availableSlots || 0} {t('freeSlots').toLowerCase()}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs text-text-light">{t('experience')}</p>
                                                <p className="font-semibold text-text-primary">{doctor.experience} {t('yearsShort')}</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs text-text-light">{t('fee')}</p>
                                                <p className="font-semibold text-text-primary">{currency.format(doctor.consultationFee || 0)}</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs text-text-light">{t('nextSlot')}</p>
                                                <p className="font-semibold text-text-primary text-xs">{formatDateTimeLocal(doctor.nextAvailableSlot)}</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs text-text-light">{t('reviews')}</p>
                                                <p className="font-semibold text-text-primary">{doctor.reviews?.length || 0}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <PaymentStep
                        checkout={checkoutBooking}
                        gateway={gateway}
                        onGatewayChange={setGateway}
                        onCreateOrder={handleCreateOrder}
                        onCompletePayment={handleCompletePayment}
                        onClose={() => setCheckoutBooking(null)}
                        busy={busyAction}
                        t={t}
                        translateEnum={translateEnum}
                        formatDateTimeLocal={formatDateTimeLocal}
                    />
                </div>

                <div className="space-y-4">
                    <div className="stat-card space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-primary">{t('doctorProfile')}</p>
                                <h3 className="text-xl font-bold text-text-primary">{selectedDoctor?.name || t('selectDoctor')}</h3>
                            </div>
                            <label className="block">
                                <span className="block text-xs text-text-light mb-1">{t('availabilityDate')}</span>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                    className="input-field min-w-[180px]"
                                />
                            </label>
                        </div>

                        {loadingDetail ? (
                            <div className="py-10 text-center text-text-secondary">{t('loadingAvailability')}</div>
                        ) : doctorDetail ? (
                            <>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="flex items-start gap-3">
                                        <Hospital size={18} className="text-primary mt-1" />
                                        <div>
                                            <p className="font-semibold text-text-primary">{doctorDetail.hospital?.name || selectedDoctor?.hospitalName}</p>
                                            <p className="text-sm text-text-secondary">{doctorDetail.hospital?.address}</p>
                                            <p className="text-sm text-text-secondary mt-1">
                                                {t('contact')}: {doctorDetail.hospital?.phone || t('notAvailable')}
                                            </p>
                                            <p className="text-sm text-text-secondary mt-1">
                                                {t('services')}: {(doctorDetail.hospital?.servicesProvided?.length
                                                    ? doctorDetail.hospital.servicesProvided
                                                    : doctorDetail.hospital?.specialists || []).join(', ') || t('generalConsultation')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <label className="block">
                                    <span className="block text-sm font-medium text-text-secondary mb-2">{t('reasonForConsultation')}</span>
                                    <textarea
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        className="input-field min-h-24"
                                        placeholder={t('describeSymptomsQuestions')}
                                    />
                                </label>

                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CalendarDays size={18} className="text-teal" />
                                        <h4 className="font-semibold text-text-primary">
                                            {doctorDetail.availableSlots?.length ? t('freeSlots') : t('upcomingCreatedSlots')}
                                        </h4>
                                    </div>
                                    {slotsToDisplay.length ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {slotsToDisplay.map((slot) => (
                                                <div key={slot._id} className="rounded-2xl border border-slate-100 p-4 bg-white">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className="font-semibold text-text-primary">{slot.slotStartTime} - {slot.slotEndTime}</p>
                                                            <p className="text-sm text-text-secondary">{formatDateTimeLocal(slot.startsAt)}</p>
                                                        </div>
                                                        <Video size={18} className="text-primary" />
                                                    </div>
                                                    <div className="flex items-center justify-between mt-4">
                                                        <span className="text-sm font-semibold text-text-primary">{currency.format(slot.consultationFee)}</span>
                                                        <button onClick={() => handleSlotHold(slot._id)} disabled={busyAction} className="btn-primary justify-center">
                                                            <Clock3 size={16} /> {t('holdSlot')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                                            {t('noDoctorCreatedSlots')}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="py-10 text-center text-text-secondary">{t('chooseDoctorToReview')}</div>
                        )}
                    </div>

                    <div className="stat-card space-y-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={18} className="text-teal" />
                            <h3 className="font-semibold text-text-primary">{t('upcomingConsultations')}</h3>
                        </div>
                        {upcomingBookings.length ? upcomingBookings.map((booking) => (
                            <div key={booking._id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-text-primary">{booking.doctor?.name}</p>
                                        <p className="text-sm text-text-secondary">{booking.doctor?.specialization}</p>
                                        <p className="text-sm text-text-secondary mt-1">{formatDateTimeLocal(booking.consultationDate)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`risk-badge ${statusTone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                        <span className={`risk-badge ${statusTone(booking.paymentStatus)}`}>{translateEnum('status', booking.paymentStatus)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-text-light">{t('hospital')}</p>
                                        <p className="font-semibold text-text-primary">{booking.hospital?.name}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-text-light">Meeting</p>
                                        <p className="font-semibold text-text-primary break-all">{booking.meeting?.meetingLink || t('generatedAfterAdminConfirmation')}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => handleCancelBooking(booking._id)} disabled={busyAction} className="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors">
                                        {t('cancel')}
                                    </button>
                                    {selectedSlotIdsForReschedule.size > 0 && (
                                        <button
                                            onClick={() => handleReschedule(booking._id, booking.doctor?._id)}
                                            disabled={busyAction}
                                            className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 transition-colors"
                                        >
                                            {t('rescheduleToNextFreeSlot')}
                                        </button>
                                    )}
                                    {booking.bookingStatus === 'confirmed' && booking.meeting?.meetingLink && (
                                        <a
                                            href={booking.meeting.meetingLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-primary justify-center"
                                        >
                                            <Video size={16} /> {t('joinMeeting')}
                                        </a>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                                {t('noActiveConsultations')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="stat-card space-y-4">
                <div className="flex items-center gap-2">
                    <Star size={18} className="text-warning" />
                    <h3 className="font-semibold text-text-primary">{t('consultationHistoryFeedback')}</h3>
                </div>
                {historyBookings.length ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {historyBookings.map((booking) => (
                            <div key={booking._id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-text-primary">{booking.doctor?.name}</p>
                                        <p className="text-sm text-text-secondary">{formatDateTimeLocal(booking.consultationDate)}</p>
                                    </div>
                                    <span className={`risk-badge ${statusTone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                </div>
                                <p className="text-sm text-text-secondary">
                                    Payment status: <span className="font-medium text-text-primary">{booking.paymentStatus}</span>
                                </p>
                                {booking.bookingStatus === 'completed' && (
                                    <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
                                        <div className="grid grid-cols-5 gap-2">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setReviewDrafts((current) => ({
                                                        ...current,
                                                        [booking._id]: { ...(current[booking._id] || {}), rating: value }
                                                    }))}
                                                    className={`py-2 rounded-xl font-semibold transition-colors ${
                                                        reviewDrafts[booking._id]?.rating === value
                                                            ? 'bg-primary text-white'
                                                            : 'bg-white text-text-secondary border border-slate-200'
                                                    }`}
                                                >
                                                    {value}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            value={reviewDrafts[booking._id]?.comment || ''}
                                            onChange={(event) => setReviewDrafts((current) => ({
                                                ...current,
                                                [booking._id]: { ...(current[booking._id] || {}), comment: event.target.value }
                                            }))}
                                            className="input-field min-h-24"
                                            placeholder={t('shareExperience')}
                                        />
                                        <button onClick={() => handleReviewSubmit(booking._id)} disabled={busyAction} className="btn-primary justify-center">
                                            {t('submitFeedback')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl bg-slate-50 p-6 text-sm text-text-secondary">
                        Completed, cancelled, and rejected consultations will appear here.
                    </div>
                )}
            </div>
        </motion.section>
    );
}
