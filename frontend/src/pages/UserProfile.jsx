import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, MapPin, Calendar, UserRound, ClipboardList, Stethoscope } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../components/AccessibilityProvider';

export default function UserProfile() {
    const { user, updateUser } = useAuth();
    const { t, locale, translateEnum } = useAccessibility();
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState('');
    const [bookings, setBookings] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [doctorProfile, setDoctorProfile] = useState(null);
    const [loadingDoctorProfile, setLoadingDoctorProfile] = useState(false);
    const [editingPersonal, setEditingPersonal] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState(false);
    const [personalDraft, setPersonalDraft] = useState({ name: '', phone: '' });
    const [professionalDraft, setProfessionalDraft] = useState({
        specialization: '',
        hospitalName: '',
        consultationFee: '',
        experience: '',
        consultationModes: [],
        available: true
    });
    const [savingPersonal, setSavingPersonal] = useState(false);
    const [savingProfessional, setSavingProfessional] = useState(false);
    const [personalMessage, setPersonalMessage] = useState('');
    const [personalError, setPersonalError] = useState('');
    const [professionalMessage, setProfessionalMessage] = useState('');
    const [professionalError, setProfessionalError] = useState('');
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);

    const formatDate = (value) => {
        if (!value) return t('notAvailable');
        return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatDateTime = (value) => {
        if (!value) return t('notAvailable');
        return new Date(value).toLocaleString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const statusTone = (status) => {
        if (status === 'confirmed' || status === 'completed' || status === 'paid') return 'risk-routine';
        if (status === 'payment_completed' || status === 'pending') return 'risk-urgent';
        if (status === 'cancelled' || status === 'rejected' || status === 'failed') return 'risk-emergency';
        return 'risk-urgent';
    };

    useEffect(() => {
        api.get('/auth/me')
            .then((res) => setProfile(res.data))
            .catch((error) => setProfileError(error.response?.data?.message || 'Unable to load profile'));
    }, []);

    useEffect(() => {
        if (user?.role !== 'doctor') return;
        setLoadingDoctorProfile(true);
        api.get('/consultations/doctor/me')
            .then((res) => setDoctorProfile(res.data))
            .catch(() => setDoctorProfile(null))
            .finally(() => setLoadingDoctorProfile(false));
    }, [user?.role]);

    const beginEditPersonal = () => {
        setPersonalMessage('');
        setPersonalError('');
        setPersonalDraft({
            name: profile?.name || user?.name || '',
            phone: profile?.phone || ''
        });
        setEditingPersonal(true);
    };

    const cancelEditPersonal = () => {
        setEditingPersonal(false);
        setPersonalError('');
    };

    const savePersonal = async () => {
        setSavingPersonal(true);
        setPersonalMessage('');
        setPersonalError('');
        try {
            const res = await api.put('/auth/me', {
                name: personalDraft.name,
                phone: personalDraft.phone
            });
            setProfile(res.data);
            updateUser(res.data);
            setEditingPersonal(false);
            setPersonalMessage(t('profileUpdated'));
        } catch (error) {
            setPersonalError(error.response?.data?.message || t('profileUpdateFailed'));
        } finally {
            setSavingPersonal(false);
        }
    };

    const beginEditProfessional = () => {
        if (!doctorProfile?.doctor) return;
        setProfessionalMessage('');
        setProfessionalError('');
        setProfessionalDraft({
            specialization: doctorProfile.doctor.specialization || '',
            hospitalName: doctorProfile.doctor.hospital?.name || doctorProfile.doctor.hospitalName || '',
            consultationFee: doctorProfile.doctor.consultationFee ?? '',
            experience: doctorProfile.doctor.experience ?? '',
            consultationModes: doctorProfile.doctor.consultationModes || [],
            available: doctorProfile.doctor.available ?? true
        });
        setEditingProfessional(true);
    };

    const cancelEditProfessional = () => {
        setEditingProfessional(false);
        setProfessionalError('');
    };

    const toggleMode = (mode) => {
        setProfessionalDraft((current) => {
            const set = new Set(current.consultationModes);
            if (set.has(mode)) {
                set.delete(mode);
            } else {
                set.add(mode);
            }
            return { ...current, consultationModes: Array.from(set) };
        });
    };

    const saveProfessional = async () => {
        if (!doctorProfile?.doctor) return;
        setSavingProfessional(true);
        setProfessionalMessage('');
        setProfessionalError('');
        try {
            const payload = {
                specialization: professionalDraft.specialization,
                hospitalName: professionalDraft.hospitalName,
                consultationFee: professionalDraft.consultationFee === '' ? undefined : Number(professionalDraft.consultationFee),
                experience: professionalDraft.experience === '' ? undefined : Number(professionalDraft.experience),
                consultationModes: professionalDraft.consultationModes,
                available: professionalDraft.available
            };
            const res = await api.put('/consultations/doctor/me', payload);
            setDoctorProfile(res.data);
            setEditingProfessional(false);
            setProfessionalMessage(t('profileUpdated'));
        } catch (error) {
            setProfessionalError(error.response?.data?.message || t('profileUpdateFailed'));
        } finally {
            setSavingProfessional(false);
        }
    };

    useEffect(() => {
        if (user?.role !== 'patient') return;
        setLoadingBookings(true);
        api.get('/consultations/patient/bookings')
            .then((res) => setBookings(res.data || []))
            .catch(() => setBookings([]))
            .finally(() => setLoadingBookings(false));
    }, [user?.role]);

    useEffect(() => {
        if (user?.role !== 'patient') return;
        setLoadingDiagnoses(true);
        api.get('/diagnosis/history')
            .then((res) => setDiagnoses(res.data || []))
            .catch(() => setDiagnoses([]))
            .finally(() => setLoadingDiagnoses(false));
    }, [user?.role]);

    const pastBookings = useMemo(() => (
        bookings.filter((booking) => ['completed', 'cancelled', 'rejected'].includes(booking.bookingStatus))
    ), [bookings]);

    const role = profile?.role || user?.role || 'patient';
    const profileTitle = role === 'doctor'
        ? t('doctorProfileTitle')
        : role === 'admin'
            ? t('adminProfileTitle')
            : t('patientProfileTitle');
    const profileSubtitle = role === 'doctor'
        ? t('doctorProfileSubtitle')
        : role === 'admin'
            ? t('adminProfileSubtitle')
            : t('patientProfileSubtitle');

    const doctor = doctorProfile?.doctor;
    const hospitalName = doctor?.hospital?.name || doctor?.hospitalName || t('notAvailable');

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="stat-card">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                        <UserRound size={20} className="text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary">{profileTitle}</h2>
                        <p className="text-sm text-text-secondary">{profileSubtitle}</p>
                    </div>
                </div>
                {profileError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {profileError}
                    </div>
                )}
            </div>

            <div className="stat-card">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary" />
                        <h3 className="font-semibold text-text-primary">{t('personalDetails')}</h3>
                    </div>
                    <button
                        onClick={editingPersonal ? cancelEditPersonal : beginEditPersonal}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        {editingPersonal ? t('cancel') : t('edit')}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs text-text-light">{t('fullName')}</p>
                        {editingPersonal ? (
                            <input
                                value={personalDraft.name}
                                onChange={(event) => setPersonalDraft((current) => ({ ...current, name: event.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            />
                        ) : (
                            <p className="font-semibold text-text-primary">{profile?.name || user?.name || t('notAvailable')}</p>
                        )}
                        <p className="mt-3 text-xs text-text-light">{t('role')}</p>
                        <p className="font-semibold text-text-primary capitalize">{role}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs text-text-light">{t('email')}</p>
                        <p className="font-semibold text-text-primary flex items-center gap-2"><Mail size={14} /> {profile?.email || user?.email || t('notAvailable')}</p>
                        <p className="mt-3 text-xs text-text-light">{t('phone')}</p>
                        {editingPersonal ? (
                            <input
                                value={personalDraft.phone}
                                onChange={(event) => setPersonalDraft((current) => ({ ...current, phone: event.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            />
                        ) : (
                            <p className="font-semibold text-text-primary flex items-center gap-2"><Phone size={14} /> {profile?.phone || t('notAvailable')}</p>
                        )}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs text-text-light">{t('memberSince')}</p>
                        <p className="font-semibold text-text-primary flex items-center gap-2"><Calendar size={14} /> {formatDate(profile?.createdAt)}</p>
                        <p className="mt-3 text-xs text-text-light">{t('location')}</p>
                        <p className="font-semibold text-text-primary flex items-center gap-2">
                            <MapPin size={14} />
                            {profile?.location
                                ? `${profile.location.lat?.toFixed(3)}, ${profile.location.lng?.toFixed(3)}`
                                : t('notAvailable')}
                        </p>
                    </div>
                </div>
                {editingPersonal && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            onClick={cancelEditPersonal}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={savePersonal}
                            disabled={savingPersonal}
                            className="btn-primary disabled:opacity-60"
                        >
                            {savingPersonal ? t('saving') : t('save')}
                        </button>
                    </div>
                )}
                {personalMessage && (
                    <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                        {personalMessage}
                    </div>
                )}
                {personalError && (
                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {personalError}
                    </div>
                )}
            </div>

            {role === 'doctor' && (
                <div className="stat-card">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <ClipboardList size={18} className="text-teal" />
                            <h3 className="font-semibold text-text-primary">{t('professionalDetails')}</h3>
                        </div>
                        <button
                            onClick={editingProfessional ? cancelEditProfessional : beginEditProfessional}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            {editingProfessional ? t('cancel') : t('edit')}
                        </button>
                    </div>
                    {loadingDoctorProfile ? (
                        <div className="py-8 text-center text-text-secondary">{t('loading')}</div>
                    ) : doctor ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <p className="text-xs text-text-light">{t('specialization')}</p>
                                {editingProfessional ? (
                                    <input
                                        value={professionalDraft.specialization}
                                        onChange={(event) => setProfessionalDraft((current) => ({ ...current, specialization: event.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                    />
                                ) : (
                                    <p className="font-semibold text-text-primary">{doctor.specialization || t('notAvailable')}</p>
                                )}
                                <p className="mt-3 text-xs text-text-light">{t('hospital')}</p>
                                {editingProfessional ? (
                                    <input
                                        value={professionalDraft.hospitalName}
                                        onChange={(event) => setProfessionalDraft((current) => ({ ...current, hospitalName: event.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                    />
                                ) : (
                                    <p className="font-semibold text-text-primary">{hospitalName}</p>
                                )}
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <p className="text-xs text-text-light">{t('consultationFee')}</p>
                                {editingProfessional ? (
                                    <input
                                        type="number"
                                        value={professionalDraft.consultationFee}
                                        onChange={(event) => setProfessionalDraft((current) => ({ ...current, consultationFee: event.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                    />
                                ) : (
                                    <p className="font-semibold text-text-primary">{doctor.consultationFee ?? t('notAvailable')}</p>
                                )}
                                <p className="mt-3 text-xs text-text-light">{t('experience')}</p>
                                {editingProfessional ? (
                                    <input
                                        type="number"
                                        value={professionalDraft.experience}
                                        onChange={(event) => setProfessionalDraft((current) => ({ ...current, experience: event.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                    />
                                ) : (
                                    <p className="font-semibold text-text-primary">{doctor.experience ? `${doctor.experience} ${t('yearsShort')}` : t('notAvailable')}</p>
                                )}
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <p className="text-xs text-text-light">{t('availability')}</p>
                                {editingProfessional ? (
                                    <label className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={professionalDraft.available}
                                            onChange={(event) => setProfessionalDraft((current) => ({ ...current, available: event.target.checked }))}
                                            className="h-4 w-4 accent-teal-600"
                                        />
                                        {t('status_available')}
                                    </label>
                                ) : (
                                    <p className="font-semibold text-text-primary">{doctor.available ? t('status_available') : t('status_booked')}</p>
                                )}
                                <p className="mt-3 text-xs text-text-light">{t('consultationMode')}</p>
                                {editingProfessional ? (
                                    <div className="mt-1 space-y-1 text-xs text-slate-600">
                                        {['online', 'video', 'audio'].map((mode) => (
                                            <label key={mode} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={professionalDraft.consultationModes.includes(mode)}
                                                    onChange={() => toggleMode(mode)}
                                                    className="h-3.5 w-3.5 accent-teal-600"
                                                />
                                                {mode}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="font-semibold text-text-primary">
                                        {(doctor.consultationModes || []).length ? doctor.consultationModes.join(', ') : t('notAvailable')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-slate-50 p-4 text-sm text-text-secondary">
                            {t('noDoctorProfile')}
                        </div>
                    )}
                    {editingProfessional && doctor && (
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={cancelEditProfessional}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={saveProfessional}
                                disabled={savingProfessional}
                                className="btn-primary disabled:opacity-60"
                            >
                                {savingProfessional ? t('saving') : t('save')}
                            </button>
                        </div>
                    )}
                    {professionalMessage && (
                        <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                            {professionalMessage}
                        </div>
                    )}
                    {professionalError && (
                        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {professionalError}
                        </div>
                    )}
                </div>
            )}

            {user?.role === 'patient' && (
                <>
                    <div className="stat-card">
                        <div className="flex items-center gap-2 mb-4">
                            <ClipboardList size={18} className="text-teal" />
                            <h3 className="font-semibold text-text-primary">{t('pastBookings')}</h3>
                        </div>
                        {loadingBookings ? (
                            <div className="py-8 text-center text-text-secondary">{t('loading')}</div>
                        ) : pastBookings.length ? (
                            <div className="grid grid-cols-1 gap-4">
                                {pastBookings.map((booking) => (
                                    <div key={booking._id} className="rounded-2xl border border-slate-100 p-4">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-text-primary">{booking.doctor?.name || t('doctor')}</p>
                                                <p className="text-sm text-text-secondary">{booking.doctor?.specialization}</p>
                                                <p className="text-sm text-text-secondary mt-1">{formatDateTime(booking.consultationDate)}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`risk-badge ${statusTone(booking.bookingStatus)}`}>{translateEnum('status', booking.bookingStatus)}</span>
                                                <span className={`risk-badge ${statusTone(booking.paymentStatus)}`}>{translateEnum('status', booking.paymentStatus)}</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-sm text-text-secondary">
                                            <span className="font-medium text-text-primary">{t('hospital')}:</span> {booking.hospital?.name || booking.hospitalName || t('notAvailable')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-slate-50 p-4 text-sm text-text-secondary">
                                {t('noPastBookings')}
                            </div>
                        )}
                    </div>

                    <div className="stat-card">
                        <div className="flex items-center gap-2 mb-4">
                            <Stethoscope size={18} className="text-primary" />
                            <h3 className="font-semibold text-text-primary">{t('pastHealthChecks')}</h3>
                        </div>
                        {loadingDiagnoses ? (
                            <div className="py-8 text-center text-text-secondary">{t('loading')}</div>
                        ) : diagnoses.length ? (
                            <div className="grid grid-cols-1 gap-4">
                                {diagnoses.slice(0, 8).map((item) => {
                                    const riskLevel = item.riskLevel || item.risk_level || t('notAvailable');
                                    const confidence = typeof item.confidence === 'number' ? `${Math.round(item.confidence * 100)}%` : t('notAvailable');
                                    return (
                                        <div key={item._id} className="rounded-2xl border border-slate-100 p-4">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-text-primary">{item.prediction || t('notAvailable')}</p>
                                                    <p className="text-sm text-text-secondary">{formatDateTime(item.createdAt)}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-sm">
                                                    <span className="risk-badge risk-routine">{riskLevel}</span>
                                                    <span className="risk-badge risk-urgent">{t('confidence')}: {confidence}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-sm text-text-secondary">
                                                {t('symptomsSelected', { count: item.symptoms?.length || 0 })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-slate-50 p-4 text-sm text-text-secondary">
                                {t('noHealthChecks')}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
