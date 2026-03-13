const express = require('express');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const DoctorAvailability = require('../models/DoctorAvailability');
const ConsultationBooking = require('../models/ConsultationBooking');
const Payment = require('../models/Payment');
const Meeting = require('../models/Meeting');
const paymentService = require('../services/paymentService');
const meetingService = require('../services/meetingService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const LOCK_WINDOW_MS = 10 * 60 * 1000;

const bookingPopulate = [
    { path: 'patient', select: 'name email phone' },
    { path: 'doctor', populate: { path: 'hospital', select: 'name address phone contactEmail servicesProvided specialists' } },
    { path: 'hospital', select: 'name address phone contactEmail servicesProvided specialists' },
    { path: 'slot' },
    { path: 'meeting' }
];

function escapeRegex(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateInput(dateValue) {
    if (dateValue instanceof Date) {
        return new Date(dateValue);
    }

    const normalized = String(dateValue || '').trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    }

    return new Date(normalized);
}

function getStartOfDay(dateValue) {
    const date = parseDateInput(dateValue);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getEndOfDay(dateValue) {
    const date = parseDateInput(dateValue);
    date.setHours(23, 59, 59, 999);
    return date;
}

function mergeDateAndTime(dateValue, time) {
    const [hours = '0', minutes = '0'] = String(time || '').split(':');
    const date = parseDateInput(dateValue);
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date;
}

function appendStatus(booking, status, user, note) {
    booking.statusHistory.push({
        status,
        note,
        changedBy: user?.id || user?._id,
        changedByRole: user?.role,
        changedAt: new Date()
    });
}

function emitConsultationEvent(req, event, payload) {
    const io = req.app.get('io');
    if (io) {
        io.emit(event, payload);
    }
}

async function resolveDoctorForUser(user) {
    return Doctor.findOne({
        $or: [
            { user: user.id },
            { name: user.name }
        ]
    }).populate('hospital');
}

function assignMeetingPayload(meeting, payload) {
    meeting.meetingId = payload.meetingId;
    meeting.provider = payload.provider;
    meeting.meetingLink = payload.meetingLink;
    meeting.organizerEmail = payload.organizerEmail || null;
    meeting.meetingTime = payload.meetingTime;
    meeting.doctorName = payload.doctorName;
    meeting.patientName = payload.patientName;
    meeting.providerMetadata = payload.providerMetadata;
    if (meeting.meetingStatus !== 'live') {
        meeting.meetingStatus = payload.meetingStatus || 'scheduled';
    }
}

async function ensureRealMeetingLink(booking) {
    if (!booking?.meeting || !meetingService.needsMeetingRefresh(booking.meeting)) {
        return booking?.meeting || null;
    }

    const meetingPayload = await meetingService.createMeetingPayload({
        bookingId: booking._id,
        meetingTime: booking.consultationDate,
        doctorName: booking.doctor?.name,
        patientName: booking.patient?.name
    });

    assignMeetingPayload(booking.meeting, meetingPayload);
    await booking.meeting.save();
    return booking.meeting;
}

async function ensureRealMeetingLinks(bookings) {
    await Promise.all(bookings.map((booking) => ensureRealMeetingLink(booking)));
}

async function notifyConsultation({
    patient,
    doctor,
    hospital,
    booking,
    meeting,
    payment,
    template,
    statusLabel
}) {
    const notifications = { email: null, sms: null };

    try {
        notifications.email = await emailService.sendConsultationEmail({
            to: patient?.email,
            patientName: patient?.name,
            doctorName: doctor?.name,
            hospitalName: hospital?.name || doctor?.hospitalName,
            meetingTime: meeting?.meetingTime || booking?.consultationDate,
            meetingLink: meeting?.meetingLink,
            bookingId: booking?._id,
            transactionId: payment?.transactionId,
            template,
            statusLabel
        });
    } catch (error) {
        notifications.email = { success: false, message: error.message };
    }

    try {
        if (patient?.phone) {
            notifications.sms = await smsService.sendConsultationSMS({
                to: patient.phone,
                doctorName: doctor?.name,
                hospitalName: hospital?.name || doctor?.hospitalName,
                meetingTime: meeting?.meetingTime || booking?.consultationDate,
                meetingLink: meeting?.meetingLink,
                bookingId: booking?._id,
                statusLabel
            });
        }
    } catch (error) {
        notifications.sms = { success: false, message: error.message };
    }

    return notifications;
}

async function buildDoctorLookupFilters(query) {
    const filters = {
        consultationEnabled: { $ne: false }
    };

    if (query.specialization) {
        filters.specialization = new RegExp(escapeRegex(query.specialization), 'i');
    }

    if (query.minRating) {
        filters.rating = { ...(filters.rating || {}), $gte: Number(query.minRating) };
    }

    if (query.maxFee) {
        filters.$and = [
            ...(filters.$and || []),
            {
                $or: [
                    { consultationFee: { $lte: Number(query.maxFee) } },
                    { consultationFee: { $exists: false } },
                    { consultationFee: null }
                ]
            }
        ];
    }

    if (query.minFee) {
        filters.$and = [
            ...(filters.$and || []),
            {
                $or: [
                    { consultationFee: { $gte: Number(query.minFee) } },
                    { consultationFee: { $exists: false } },
                    { consultationFee: null }
                ]
            }
        ];
    }

    if (query.hospital) {
        const matchingHospitals = await Hospital.find({
            name: new RegExp(escapeRegex(query.hospital), 'i')
        }).select('_id');
        filters.$or = [
            { hospitalName: new RegExp(escapeRegex(query.hospital), 'i') },
            ...(matchingHospitals.length
                ? [{ hospital: { $in: matchingHospitals.map((hospital) => hospital._id) } }]
                : [])
        ];
    }

    if (query.location) {
        const matchingHospitals = await Hospital.find({
            address: new RegExp(escapeRegex(query.location), 'i')
        }).select('_id');
        if (matchingHospitals.length) {
            filters.$and = [
                ...(filters.$and || []),
                { hospital: { $in: matchingHospitals.map((hospital) => hospital._id) } }
            ];
        }
    }

    if (query.search) {
        const keyword = new RegExp(escapeRegex(query.search), 'i');
        filters.$or = [
            ...(filters.$or || []),
            { name: keyword },
            { specialization: keyword },
            { hospitalName: keyword }
        ];
    }

    return filters;
}

router.get('/meta', async (req, res) => {
    try {
        const [specializations, hospitals] = await Promise.all([
            Doctor.distinct('specialization'),
            Hospital.find().select('name address')
        ]);

        res.json({
            specializations: specializations.filter(Boolean).sort(),
            hospitals
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/doctors', async (req, res) => {
    try {
        const doctorFilters = await buildDoctorLookupFilters(req.query);
        const doctors = await Doctor.find(doctorFilters)
            .populate('hospital')
            .sort({ rating: -1, experience: -1 });

        const now = new Date();
        const doctorIds = doctors.map((doctor) => doctor._id);
        const slotCounts = await DoctorAvailability.aggregate([
            {
                $match: {
                    doctor: { $in: doctorIds },
                    createdByUser: { $exists: true, $ne: null },
                    startsAt: { $gte: now },
                    $or: [
                        { status: 'available' },
                        { status: 'locked', lockExpiresAt: { $lte: now } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$doctor',
                    availableSlots: { $sum: 1 },
                    nextAvailableSlot: { $min: '$startsAt' }
                }
            }
        ]);

        const slotMap = new Map(slotCounts.map((item) => [String(item._id), item]));
        const response = doctors.filter((doctor) => slotMap.has(String(doctor._id))).map((doctor) => {
            const slotInfo = slotMap.get(String(doctor._id));
            return {
                ...doctor.toObject(),
                availableSlots: slotInfo?.availableSlots || 0,
                nextAvailableSlot: slotInfo?.nextAvailableSlot || null,
                consultationFee: doctor.consultationFee || 500,
                hospitalDetails: doctor.hospital ? {
                    _id: doctor.hospital._id,
                    hospitalName: doctor.hospital.name,
                    address: doctor.hospital.address,
                    contact: doctor.hospital.phone,
                    servicesProvided: doctor.hospital.servicesProvided?.length
                        ? doctor.hospital.servicesProvided
                        : doctor.hospital.specialists
                } : null
            };
        });

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/doctors/:doctorId', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.doctorId).populate('hospital');
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const date = req.query.date ? getStartOfDay(req.query.date) : getStartOfDay(new Date());
        const endOfDate = getEndOfDay(date);
        const now = new Date();
        const slots = await DoctorAvailability.find({
            doctor: doctor._id,
            createdByUser: { $exists: true, $ne: null },
            startsAt: { $gte: now > date ? now : date, $lte: endOfDate },
            $or: [
                { status: 'available' },
                { status: 'locked', lockExpiresAt: { $lte: now } }
            ]
        }).sort({ startsAt: 1 });

        const upcomingSlots = await DoctorAvailability.find({
            doctor: doctor._id,
            createdByUser: { $exists: true, $ne: null },
            startsAt: { $gte: now },
            $or: [
                { status: 'available' },
                { status: 'locked', lockExpiresAt: { $lte: now } }
            ]
        }).sort({ startsAt: 1 }).limit(20);

        res.json({
            doctor,
            hospital: doctor.hospital,
            selectedDate: date,
            availableSlots: slots,
            upcomingSlots
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route GET /api/consultations/doctor/me
router.get('/doctor/me', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found' });
        }
        res.json({ doctor, hospital: doctor.hospital || null });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route PUT /api/consultations/doctor/me
router.put('/doctor/me', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ user: req.user.id }).populate('hospital');
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found' });
        }

        const updates = {};
        if (typeof req.body.specialization === 'string' && req.body.specialization.trim()) {
            updates.specialization = req.body.specialization.trim();
        }
        if (typeof req.body.hospitalName === 'string') {
            updates.hospitalName = req.body.hospitalName.trim();
        }
        if (req.body.consultationFee !== undefined && req.body.consultationFee !== null) {
            updates.consultationFee = Number(req.body.consultationFee);
        }
        if (req.body.experience !== undefined && req.body.experience !== null) {
            updates.experience = Number(req.body.experience);
        }
        if (typeof req.body.bio === 'string') {
            updates.bio = req.body.bio.trim();
        }
        if (Array.isArray(req.body.languages)) {
            updates.languages = req.body.languages.filter(Boolean);
        }
        if (Array.isArray(req.body.consultationModes)) {
            updates.consultationModes = req.body.consultationModes.filter(Boolean);
        }
        if (typeof req.body.available === 'boolean') {
            updates.available = req.body.available;
        }
        if (typeof req.body.consultationEnabled === 'boolean') {
            updates.consultationEnabled = req.body.consultationEnabled;
        }

        const updated = await Doctor.findByIdAndUpdate(doctor._id, updates, {
            new: true,
            runValidators: true
        }).populate('hospital');

        res.json({ doctor: updated, hospital: updated.hospital || null });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/hospitals/:hospitalId', async (req, res) => {
    try {
        const hospital = await Hospital.findById(req.params.hospitalId);
        if (!hospital) {
            return res.status(404).json({ message: 'Hospital not found' });
        }

        const affiliatedDoctors = await Doctor.find({ hospital: hospital._id, consultationEnabled: true })
            .sort({ rating: -1, experience: -1 });

        res.json({
            ...hospital.toObject(),
            hospitalName: hospital.name,
            contact: hospital.phone,
            servicesProvided: hospital.servicesProvided?.length ? hospital.servicesProvided : hospital.specialists,
            affiliatedDoctors
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/patient/bookings', protect, authorize('patient'), async (req, res) => {
    try {
        const bookings = await ConsultationBooking.find({ patient: req.user.id })
            .populate(bookingPopulate)
            .sort({ consultationDate: 1, createdAt: -1 });

        await ensureRealMeetingLinks(bookings);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/hold', protect, authorize('patient'), async (req, res) => {
    try {
        const { doctorId, slotId, reason, notes } = req.body;
        if (!doctorId || !slotId) {
            return res.status(400).json({ message: 'Doctor and slot are required' });
        }

        const doctor = await Doctor.findById(doctorId).populate('hospital');
        if (!doctor || !doctor.consultationEnabled) {
            return res.status(404).json({ message: 'Doctor is not available for consultation' });
        }

        const now = new Date();
        const lockExpiresAt = new Date(now.getTime() + LOCK_WINDOW_MS);
        const slot = await DoctorAvailability.findOneAndUpdate({
            _id: slotId,
            doctor: doctor._id,
            startsAt: { $gte: now },
            $or: [
                { status: 'available' },
                { status: 'locked', lockExpiresAt: { $lte: now } }
            ]
        }, {
            status: 'locked',
            lockedBy: req.user.id,
            lockExpiresAt
        }, { new: true });

        if (!slot) {
            return res.status(409).json({ message: 'Selected slot is no longer available' });
        }

        const overlappingBooking = await ConsultationBooking.findOne({
            patient: req.user.id,
            consultationDate: slot.startsAt,
            bookingStatus: { $in: ['pending_payment', 'payment_completed', 'confirmed'] }
        });

        if (overlappingBooking) {
            await DoctorAvailability.findByIdAndUpdate(slot._id, {
                status: 'available',
                lockedBy: null,
                lockExpiresAt: null
            });
            return res.status(409).json({ message: 'You already have a consultation at this time' });
        }

        const booking = await ConsultationBooking.create({
            patient: req.user.id,
            doctor: doctor._id,
            hospital: doctor.hospital?._id,
            slot: slot._id,
            consultationDate: slot.startsAt,
            slotStartTime: slot.slotStartTime,
            slotEndTime: slot.slotEndTime,
            consultationFee: slot.consultationFee,
            reason,
            notes,
            statusHistory: [{
                status: 'pending_payment',
                note: 'Slot locked for payment',
                changedBy: req.user.id,
                changedByRole: req.user.role,
                changedAt: new Date()
            }]
        });

        const populatedBooking = await ConsultationBooking.findById(booking._id).populate(bookingPopulate);
        emitConsultationEvent(req, 'consultation:slot-updated', {
            slotId: slot._id,
            doctorId: doctor._id,
            status: 'locked',
            lockExpiresAt
        });

        res.status(201).json({
            booking: populatedBooking,
            lockExpiresAt,
            paymentWindowMinutes: LOCK_WINDOW_MS / 60000
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/:bookingId/payment-order', protect, authorize('patient'), async (req, res) => {
    try {
        const booking = await ConsultationBooking.findOne({
            _id: req.params.bookingId,
            patient: req.user.id
        }).populate(bookingPopulate);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Payment already completed for this booking' });
        }

        const slot = await DoctorAvailability.findById(booking.slot._id);
        if (!slot || slot.status !== 'locked' || String(slot.lockedBy) !== req.user.id || !slot.lockExpiresAt || slot.lockExpiresAt <= new Date()) {
            return res.status(409).json({ message: 'Slot lock expired. Please choose a new slot.' });
        }

        const gateway = req.body.gateway || 'simulated';
        const order = await paymentService.createPaymentOrder({
            gateway,
            amount: booking.consultationFee,
            bookingId: booking._id,
            patientId: booking.patient._id,
            doctorId: booking.doctor._id
        });

        let payment = await Payment.findOne({
            booking: booking._id,
            paymentStatus: 'pending'
        }).sort({ createdAt: -1 });

        if (!payment) {
            payment = await Payment.create({
                booking: booking._id,
                patient: booking.patient._id,
                doctor: booking.doctor._id,
                amount: booking.consultationFee,
                currency: order.currency || 'INR',
                gateway: order.gateway,
                gatewayOrderId: order.orderId,
                metadata: order
            });
        } else {
            payment.gateway = order.gateway;
            payment.gatewayOrderId = order.orderId;
            payment.metadata = order;
            await payment.save();
        }

        booking.gateway = order.gateway;
        await booking.save();

        res.json({ bookingId: booking._id, paymentId: payment._id, order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/:bookingId/complete-payment', protect, authorize('patient'), async (req, res) => {
    try {
        const booking = await ConsultationBooking.findOne({
            _id: req.params.bookingId,
            patient: req.user.id
        }).populate(bookingPopulate);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const payment = await Payment.findOne({ booking: booking._id }).sort({ createdAt: -1 });
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        const verification = await paymentService.verifyPayment({
            gateway: payment.gateway,
            orderId: payment.gatewayOrderId,
            amount: payment.amount,
            payload: req.body
        });

        const slot = await DoctorAvailability.findById(booking.slot._id);
        if (!slot) {
            return res.status(404).json({ message: 'The selected slot could not be found' });
        }

        if (!verification.success) {
            payment.paymentStatus = 'failed';
            payment.failureReason = verification.reason;
            payment.metadata = verification.raw || req.body;
            await payment.save();

            booking.paymentStatus = 'failed';
            booking.bookingStatus = 'cancelled';
            appendStatus(booking, 'cancelled', req.user, `Payment failed: ${verification.reason}`);
            await booking.save();

            if (slot.status === 'locked' && String(slot.lockedBy) === req.user.id) {
                slot.status = 'available';
                slot.lockedBy = null;
                slot.lockExpiresAt = null;
                await slot.save();
            }

            emitConsultationEvent(req, 'consultation:slot-updated', {
                slotId: slot._id,
                doctorId: booking.doctor._id,
                status: 'available'
            });

            return res.status(400).json({ message: verification.reason || 'Payment verification failed' });
        }

        if (slot.status !== 'locked' || String(slot.lockedBy) !== req.user.id) {
            return res.status(409).json({ message: 'Slot lock is no longer valid. Please rebook the consultation.' });
        }

        slot.status = 'booked';
        slot.lockedBy = null;
        slot.lockExpiresAt = null;
        slot.booking = booking._id;
        await slot.save();

        payment.paymentStatus = 'paid';
        payment.transactionId = verification.transactionId;
        payment.gatewayPaymentId = verification.gatewayPaymentId;
        payment.gatewaySignature = verification.gatewaySignature;
        payment.paymentDate = new Date();
        payment.metadata = verification.raw;
        await payment.save();

        booking.paymentStatus = 'paid';

        const autoConfirm = payment.gateway === 'simulated' || String(process.env.AUTO_CONFIRM_BOOKINGS || '').toLowerCase() === 'true';
        let meeting = booking.meeting;

        if (autoConfirm) {
            if (!meeting) {
                const meetingPayload = await meetingService.createMeetingPayload({
                    bookingId: booking._id,
                    meetingTime: booking.consultationDate,
                    doctorName: booking.doctor?.name,
                    patientName: booking.patient?.name
                });
                meeting = await Meeting.create(meetingPayload);
                booking.meeting = meeting._id;
            } else if (meetingService.needsMeetingRefresh(meeting)) {
                const meetingPayload = await meetingService.createMeetingPayload({
                    bookingId: booking._id,
                    meetingTime: booking.consultationDate,
                    doctorName: booking.doctor?.name,
                    patientName: booking.patient?.name
                });
                assignMeetingPayload(meeting, meetingPayload);
                await meeting.save();
            }

            booking.bookingStatus = 'confirmed';
            appendStatus(booking, 'confirmed', req.user, 'Booking auto-confirmed after payment');
        } else {
            booking.bookingStatus = 'payment_completed';
            appendStatus(booking, 'payment_completed', req.user, 'Payment received and awaiting admin confirmation');
        }

        await booking.save();

        const patient = await User.findById(req.user.id);
        const notifications = await notifyConsultation({
            patient,
            doctor: booking.doctor,
            hospital: booking.hospital,
            booking,
            meeting,
            payment,
            template: autoConfirm ? 'booking_confirmation' : 'payment_confirmation',
            statusLabel: autoConfirm
                ? 'Your consultation has been confirmed. Meeting details are now available.'
                : 'Your payment has been received. Your consultation is awaiting admin confirmation.'
        });

        emitConsultationEvent(req, 'consultation:slot-updated', {
            slotId: slot._id,
            doctorId: booking.doctor._id,
            status: 'booked',
            bookingId: booking._id
        });
        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
            meetingId: meeting?._id
        });

        const refreshedBooking = await ConsultationBooking.findById(booking._id).populate(bookingPopulate);
        res.json({ booking: refreshedBooking, payment, notifications });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/:bookingId/cancel', protect, async (req, res) => {
    try {
        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const isOwner = String(booking.patient._id) === req.user.id;
        const doctorProfile = req.user.role === 'doctor' ? await resolveDoctorForUser(req.user) : null;
        const isAssignedDoctor = doctorProfile && String(doctorProfile._id) === String(booking.doctor._id);

        if (!(req.user.role === 'admin' || isOwner || isAssignedDoctor)) {
            return res.status(403).json({ message: 'You are not allowed to cancel this booking' });
        }

        if (['cancelled', 'completed', 'rejected'].includes(booking.bookingStatus)) {
            return res.status(400).json({ message: 'Booking cannot be cancelled' });
        }

        booking.bookingStatus = 'cancelled';
        booking.cancellationReason = req.body.reason || 'Cancelled by user';
        if (booking.paymentStatus === 'paid') {
            booking.refundStatus = 'pending';
        }
        appendStatus(booking, 'cancelled', req.user, booking.cancellationReason);
        await booking.save();

        const slot = await DoctorAvailability.findById(booking.slot._id);
        if (slot && slot.startsAt > new Date()) {
            slot.status = 'available';
            slot.lockedBy = null;
            slot.lockExpiresAt = null;
            slot.booking = null;
            await slot.save();
        }

        if (booking.meeting?._id) {
            await Meeting.findByIdAndUpdate(booking.meeting._id, { meetingStatus: 'cancelled' });
        }

        await notifyConsultation({
            patient: booking.patient,
            doctor: booking.doctor,
            hospital: booking.hospital,
            booking,
            meeting: booking.meeting,
            template: 'booking_cancellation',
            statusLabel: 'Your consultation has been cancelled.'
        });

        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: booking.bookingStatus
        });

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/:bookingId/reschedule', protect, authorize('patient', 'admin'), async (req, res) => {
    try {
        const { slotId } = req.body;
        if (!slotId) {
            return res.status(400).json({ message: 'New slot is required for reschedule' });
        }

        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (req.user.role === 'patient' && String(booking.patient._id) !== req.user.id) {
            return res.status(403).json({ message: 'You can only reschedule your own bookings' });
        }

        if (!['payment_completed', 'confirmed'].includes(booking.bookingStatus)) {
            return res.status(400).json({ message: 'Only paid bookings can be rescheduled' });
        }

        const now = new Date();
        const newSlot = await DoctorAvailability.findOneAndUpdate({
            _id: slotId,
            doctor: booking.doctor._id,
            startsAt: { $gte: now },
            $or: [
                { status: 'available' },
                { status: 'locked', lockExpiresAt: { $lte: now } }
            ]
        }, {
            status: 'booked',
            lockedBy: null,
            lockExpiresAt: null,
            booking: booking._id
        }, { new: true });

        if (!newSlot) {
            return res.status(409).json({ message: 'The selected reschedule slot is unavailable' });
        }

        const previousSlot = await DoctorAvailability.findById(booking.slot._id);
        if (previousSlot) {
            previousSlot.status = 'available';
            previousSlot.booking = null;
            previousSlot.lockedBy = null;
            previousSlot.lockExpiresAt = null;
            await previousSlot.save();
        }

        booking.slot = newSlot._id;
        booking.consultationDate = newSlot.startsAt;
        booking.slotStartTime = newSlot.slotStartTime;
        booking.slotEndTime = newSlot.slotEndTime;
        booking.bookingStatus = booking.meeting ? 'confirmed' : 'payment_completed';
        appendStatus(booking, 'rescheduled', req.user, 'Consultation rescheduled to a new time slot');
        await booking.save();

        if (booking.meeting?._id) {
            await Meeting.findByIdAndUpdate(booking.meeting._id, {
                meetingTime: newSlot.startsAt,
                meetingStatus: 'scheduled'
            });
        }

        await notifyConsultation({
            patient: booking.patient,
            doctor: booking.doctor,
            hospital: booking.hospital,
            booking,
            meeting: booking.meeting,
            statusLabel: 'Your consultation has been rescheduled.'
        });

        emitConsultationEvent(req, 'consultation:slot-updated', {
            slotId: newSlot._id,
            doctorId: booking.doctor._id,
            status: 'booked',
            bookingId: booking._id
        });

        const refreshedBooking = await ConsultationBooking.findById(booking._id).populate(bookingPopulate);
        res.json({ booking: refreshedBooking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/bookings/:bookingId/review', protect, authorize('patient'), async (req, res) => {
    try {
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const booking = await ConsultationBooking.findOne({
            _id: req.params.bookingId,
            patient: req.user.id
        }).populate('doctor');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.bookingStatus !== 'completed') {
            return res.status(400).json({ message: 'Feedback can only be added after consultation completion' });
        }

        const doctor = await Doctor.findById(booking.doctor._id);
        const existingReview = doctor.reviews.find((review) => String(review.booking) === String(booking._id));
        if (existingReview) {
            return res.status(400).json({ message: 'Feedback already submitted for this consultation' });
        }

        doctor.reviews.push({
            patient: req.user.id,
            patientName: req.user.name,
            rating,
            comment,
            booking: booking._id
        });
        doctor.rating = Number((doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length).toFixed(1));
        await doctor.save();

        res.status(201).json({ message: 'Feedback submitted successfully', rating: doctor.rating });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/doctor/availability', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found for this account' });
        }

        const slots = await DoctorAvailability.find({
            doctor: doctor._id,
            createdByUser: req.user.id,
            startsAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ startsAt: 1 });

        const bookings = await ConsultationBooking.find({
            doctor: doctor._id
        }).populate(bookingPopulate).sort({ consultationDate: 1 });

        await ensureRealMeetingLinks(bookings);
        res.json({ doctor, slots, bookings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/doctor/availability', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found for this account' });
        }

        const requestedSlots = Array.isArray(req.body.slots) ? req.body.slots : [req.body];
        const createdSlots = [];

        for (const requestedSlot of requestedSlots) {
            const { date, slotStartTime, slotEndTime, consultationFee, notes } = requestedSlot;
            if (!date || !slotStartTime || !slotEndTime) {
                return res.status(400).json({ message: 'Date, start time, and end time are required' });
            }

            const startsAt = mergeDateAndTime(date, slotStartTime);
            const endsAt = mergeDateAndTime(date, slotEndTime);
            if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
                return res.status(400).json({ message: 'Invalid slot time range' });
            }

            const legacySlot = await DoctorAvailability.findOne({
                doctor: doctor._id,
                createdByUser: { $exists: false },
                startsAt
            }) || await DoctorAvailability.findOne({
                doctor: doctor._id,
                createdByUser: null,
                startsAt
            });

            if (legacySlot) {
                legacySlot.createdByUser = req.user.id;
                legacySlot.hospital = doctor.hospital?._id;
                legacySlot.date = getStartOfDay(startsAt);
                legacySlot.startsAt = startsAt;
                legacySlot.endsAt = endsAt;
                legacySlot.slotStartTime = slotStartTime;
                legacySlot.slotEndTime = slotEndTime;
                legacySlot.consultationFee = consultationFee || doctor.consultationFee;
                legacySlot.notes = notes;
                legacySlot.status = 'available';
                legacySlot.lockedBy = null;
                legacySlot.lockExpiresAt = null;
                await legacySlot.save();
                createdSlots.push(legacySlot);
                continue;
            }

            const overlap = await DoctorAvailability.findOne({
                doctor: doctor._id,
                createdByUser: req.user.id,
                status: { $ne: 'cancelled' },
                startsAt: { $lt: endsAt },
                endsAt: { $gt: startsAt }
            });

            if (overlap) {
                if (overlap.status === 'booked') {
                    return res.status(409).json({ message: `Slot overlaps with a booked consultation at ${overlap.slotStartTime}` });
                }

                overlap.hospital = doctor.hospital?._id;
                overlap.date = getStartOfDay(startsAt);
                overlap.startsAt = startsAt;
                overlap.endsAt = endsAt;
                overlap.slotStartTime = slotStartTime;
                overlap.slotEndTime = slotEndTime;
                overlap.consultationFee = consultationFee || doctor.consultationFee;
                overlap.notes = notes;
                overlap.status = 'available';
                overlap.lockedBy = null;
                overlap.lockExpiresAt = null;
                overlap.booking = null;
                await overlap.save();
                createdSlots.push(overlap);
                continue;
            }

            const slot = await DoctorAvailability.create({
                doctor: doctor._id,
                hospital: doctor.hospital?._id,
                createdByUser: req.user.id,
                date: getStartOfDay(startsAt),
                startsAt,
                endsAt,
                slotStartTime,
                slotEndTime,
                consultationFee: consultationFee || doctor.consultationFee,
                notes
            });
            createdSlots.push(slot);
        }

        emitConsultationEvent(req, 'consultation:slot-updated', {
            doctorId: doctor._id,
            action: 'created'
        });

        res.status(201).json({ slots: createdSlots });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A slot already exists for that time' });
        }
        res.status(500).json({ message: error.message });
    }
});

router.put('/doctor/availability/:availabilityId', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found for this account' });
        }

        const slot = await DoctorAvailability.findOne({
            _id: req.params.availabilityId,
            doctor: doctor._id,
            createdByUser: req.user.id
        });

        if (!slot) {
            return res.status(404).json({ message: 'Availability slot not found' });
        }

        if (slot.status === 'booked' && req.body.status === 'cancelled') {
            return res.status(400).json({ message: 'Booked slots cannot be cancelled from availability management' });
        }

        const allowedFields = ['status', 'consultationFee', 'notes'];
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                slot[field] = req.body[field];
            }
        });
        await slot.save();

        emitConsultationEvent(req, 'consultation:slot-updated', {
            doctorId: doctor._id,
            slotId: slot._id,
            status: slot.status
        });

        res.json(slot);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/doctor/bookings/:bookingId/start', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);

        if (!doctor || !booking || String(booking.doctor._id) !== String(doctor._id)) {
            return res.status(404).json({ message: 'Consultation booking not found' });
        }

        if (booking.bookingStatus !== 'confirmed' || !booking.meeting) {
            return res.status(400).json({ message: 'Only confirmed consultations with a meeting can be started' });
        }

        await ensureRealMeetingLink(booking);
        await Meeting.findByIdAndUpdate(booking.meeting._id, {
            meetingStatus: 'live',
            startedAt: new Date()
        });

        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: booking.bookingStatus,
            meetingStatus: 'live'
        });

        res.json({ message: 'Consultation meeting started', meetingLink: booking.meeting.meetingLink });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/doctor/bookings/:bookingId/complete', protect, authorize('doctor'), async (req, res) => {
    try {
        const doctor = await resolveDoctorForUser(req.user);
        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);
        if (!doctor || !booking || String(booking.doctor._id) !== String(doctor._id)) {
            return res.status(404).json({ message: 'Consultation booking not found' });
        }

        booking.bookingStatus = 'completed';
        appendStatus(booking, 'completed', req.user, req.body.notes || 'Consultation marked as completed');
        await booking.save();

        await DoctorAvailability.findByIdAndUpdate(booking.slot._id, { status: 'completed' });
        if (booking.meeting?._id) {
            await Meeting.findByIdAndUpdate(booking.meeting._id, {
                meetingStatus: 'completed',
                endedAt: new Date()
            });
        }

        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: 'completed'
        });

        res.json({ message: 'Consultation marked as completed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/admin/bookings', protect, authorize('admin'), async (req, res) => {
    try {
        const filters = {};
        if (req.query.bookingStatus) {
            filters.bookingStatus = req.query.bookingStatus;
        }
        if (req.query.paymentStatus) {
            filters.paymentStatus = req.query.paymentStatus;
        }
        if (req.query.date) {
            filters.consultationDate = {
                $gte: getStartOfDay(req.query.date),
                $lte: getEndOfDay(req.query.date)
            };
        }

        const bookings = await ConsultationBooking.find(filters)
            .populate(bookingPopulate)
            .sort({ createdAt: -1 });

        await ensureRealMeetingLinks(bookings);
        const payments = await Payment.find().sort({ createdAt: -1 }).limit(50);
        res.json({ bookings, payments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/admin/bookings/:bookingId/confirm', protect, authorize('admin'), async (req, res) => {
    try {
        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.paymentStatus !== 'paid') {
            return res.status(400).json({ message: 'Booking must be paid before confirmation' });
        }

        let meeting = booking.meeting;
        if (!meeting) {
            const meetingPayload = await meetingService.createMeetingPayload({
                bookingId: booking._id,
                meetingTime: booking.consultationDate,
                doctorName: booking.doctor.name,
                patientName: booking.patient.name
            });
            meeting = await Meeting.create(meetingPayload);
            booking.meeting = meeting._id;
        } else if (meetingService.needsMeetingRefresh(meeting)) {
            const meetingPayload = await meetingService.createMeetingPayload({
                bookingId: booking._id,
                meetingTime: booking.consultationDate,
                doctorName: booking.doctor.name,
                patientName: booking.patient.name
            });
            assignMeetingPayload(meeting, meetingPayload);
            await meeting.save();
        }

        booking.bookingStatus = 'confirmed';
        appendStatus(booking, 'confirmed', req.user, 'Admin confirmed consultation and meeting session created');
        await booking.save();

        const payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'paid' }).sort({ createdAt: -1 });
        const notifications = await notifyConsultation({
            patient: booking.patient,
            doctor: booking.doctor,
            hospital: booking.hospital,
            booking,
            meeting,
            payment,
            template: 'booking_confirmation',
            statusLabel: 'Your consultation has been confirmed. Meeting details are now available.'
        });

        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: 'confirmed',
            meetingId: meeting._id
        });

        const refreshedBooking = await ConsultationBooking.findById(booking._id).populate(bookingPopulate);
        res.json({ booking: refreshedBooking, meeting, notifications });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/admin/bookings/:bookingId/reject', protect, authorize('admin'), async (req, res) => {
    try {
        const booking = await ConsultationBooking.findById(req.params.bookingId).populate(bookingPopulate);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.bookingStatus = 'rejected';
        if (booking.paymentStatus === 'paid') {
            booking.refundStatus = 'pending';
        }
        appendStatus(booking, 'rejected', req.user, req.body.reason || 'Booking rejected by admin');
        await booking.save();

        const slot = await DoctorAvailability.findById(booking.slot._id);
        if (slot && slot.startsAt > new Date()) {
            slot.status = 'available';
            slot.booking = null;
            slot.lockedBy = null;
            slot.lockExpiresAt = null;
            await slot.save();
        }

        if (booking.meeting?._id) {
            await Meeting.findByIdAndUpdate(booking.meeting._id, { meetingStatus: 'cancelled' });
        }

        await notifyConsultation({
            patient: booking.patient,
            doctor: booking.doctor,
            hospital: booking.hospital,
            booking,
            meeting: booking.meeting,
            template: 'booking_cancellation',
            statusLabel: 'Your consultation request was rejected by the admin team.'
        });

        emitConsultationEvent(req, 'consultation:booking-updated', {
            bookingId: booking._id,
            bookingStatus: 'rejected'
        });

        res.json({ message: 'Booking rejected successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
