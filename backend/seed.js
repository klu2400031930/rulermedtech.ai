const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Hospital = require('./models/Hospital');
const Doctor = require('./models/Doctor');
const Ambulance = require('./models/Ambulance');
const User = require('./models/User');
const DoctorAvailability = require('./models/DoctorAvailability');

const connectDB = require('./config/db');

const hospitals = [
    {
        name: 'AIIMS Rural Health Center',
        address: 'Bibinagar, Yadadri Bhuvanagiri, Telangana',
        location: { lat: 17.4975, lng: 78.8175 },
        phone: '+91-9876543210',
        icuBedsTotal: 15, icuBedsAvailable: 8,
        emergencyBedsTotal: 30, emergencyBedsAvailable: 22,
        generalBedsTotal: 100, generalBedsAvailable: 65,
        ambulancesTotal: 8, ambulancesAvailable: 5,
        specialists: ['Cardiology', 'Neurology', 'Emergency Medicine', 'General Surgery'],
        rating: 4.5
    },
    {
        name: 'Gandhi Community Hospital',
        address: 'Secunderabad, Telangana',
        location: { lat: 17.4399, lng: 78.4983 },
        phone: '+91-9876543211',
        icuBedsTotal: 10, icuBedsAvailable: 5,
        emergencyBedsTotal: 20, emergencyBedsAvailable: 14,
        generalBedsTotal: 80, generalBedsAvailable: 50,
        ambulancesTotal: 5, ambulancesAvailable: 3,
        specialists: ['General Medicine', 'Pulmonology', 'Orthopedics', 'Pediatrics'],
        rating: 4.2
    },
    {
        name: 'Nizam Rural Medical Center',
        address: 'Medchal, Telangana',
        location: { lat: 17.6300, lng: 78.4800 },
        phone: '+91-9876543212',
        icuBedsTotal: 8, icuBedsAvailable: 4,
        emergencyBedsTotal: 15, emergencyBedsAvailable: 10,
        generalBedsTotal: 60, generalBedsAvailable: 35,
        ambulancesTotal: 4, ambulancesAvailable: 3,
        specialists: ['Emergency Medicine', 'General Medicine', 'ENT', 'Dermatology'],
        rating: 4.0
    },
    {
        name: 'Osmania District Hospital',
        address: 'Koti, Hyderabad, Telangana',
        location: { lat: 17.3750, lng: 78.4800 },
        phone: '+91-9876543213',
        icuBedsTotal: 20, icuBedsAvailable: 12,
        emergencyBedsTotal: 40, emergencyBedsAvailable: 28,
        generalBedsTotal: 150, generalBedsAvailable: 90,
        ambulancesTotal: 10, ambulancesAvailable: 7,
        specialists: ['Cardiology', 'Neurology', 'Nephrology', 'General Surgery', 'Pulmonology'],
        rating: 4.6
    },
    {
        name: 'Mahavir Primary Health Center',
        address: 'Shamshabad, Telangana',
        location: { lat: 17.2543, lng: 78.4265 },
        phone: '+91-9876543214',
        icuBedsTotal: 5, icuBedsAvailable: 3,
        emergencyBedsTotal: 10, emergencyBedsAvailable: 7,
        generalBedsTotal: 40, generalBedsAvailable: 30,
        ambulancesTotal: 3, ambulancesAvailable: 2,
        specialists: ['General Medicine', 'Emergency Medicine', 'Pediatrics'],
        rating: 3.8
    }
];

const doctorNames = [
    { name: 'Dr. Priya Sharma', spec: 'Cardiology', exp: 12 },
    { name: 'Dr. Rajesh Kumar', spec: 'Neurology', exp: 15 },
    { name: 'Dr. Anita Desai', spec: 'Emergency Medicine', exp: 8 },
    { name: 'Dr. Suresh Patel', spec: 'General Surgery', exp: 20 },
    { name: 'Dr. Meera Reddy', spec: 'Pulmonology', exp: 10 },
    { name: 'Dr. Vikram Singh', spec: 'General Medicine', exp: 7 },
    { name: 'Dr. Kavitha Nair', spec: 'Orthopedics', exp: 9 },
    { name: 'Dr. Arjun Rao', spec: 'Pediatrics', exp: 11 },
    { name: 'Dr. Deepa Iyer', spec: 'Nephrology', exp: 14 },
    { name: 'Dr. Sunil Verma', spec: 'Emergency Medicine', exp: 6 },
    { name: 'Dr. Lakshmi Menon', spec: 'Cardiology', exp: 18 },
    { name: 'Dr. Arun Joshi', spec: 'Neurology', exp: 13 },
    { name: 'Dr. Pooja Gupta', spec: 'Dermatology', exp: 5 },
    { name: 'Dr. Rahul Mishra', spec: 'ENT', exp: 8 },
    { name: 'Dr. Sita Krishnan', spec: 'General Medicine', exp: 16 }
];

const seedDB = async () => {
    try {
        await connectDB();

        // Clear existing data
        await Hospital.deleteMany({});
        await Doctor.deleteMany({});
        await Ambulance.deleteMany({});
        await User.deleteMany({});
        await DoctorAvailability.deleteMany({});

        console.log('Cleared existing data');

        // Create hospitals
        const createdHospitals = await Hospital.insertMany(hospitals);
        console.log(`Created ${createdHospitals.length} hospitals`);

        // Create doctors (3 per hospital)
        const doctorsToCreate = [];
        createdHospitals.forEach((hospital, idx) => {
            for (let i = 0; i < 3; i++) {
                const docIdx = (idx * 3 + i) % doctorNames.length;
                doctorsToCreate.push({
                    name: doctorNames[docIdx].name,
                    hospital: hospital._id,
                    hospitalName: hospital.name,
                    specialization: doctorNames[docIdx].spec,
                    available: Math.random() > 0.2,
                    currentPatients: Math.floor(Math.random() * 3),
                    maxPatients: 5,
                    phone: `+91-98765${String(43200 + idx * 3 + i).padStart(5, '0')}`,
                    experience: doctorNames[docIdx].exp,
                    consultationFee: 400 + docIdx * 75,
                    bio: `${doctorNames[docIdx].name} offers online consultations for rural and remote patients.`,
                    languages: ['English', 'Hindi', idx % 2 === 0 ? 'Telugu' : 'Tamil'],
                    rating: Number((3.5 + Math.random() * 1.5).toFixed(1))
                });
            }
        });
        const createdDoctors = await Doctor.insertMany(doctorsToCreate);
        console.log(`Created ${createdDoctors.length} doctors`);

        // Create ambulances (2 per hospital)
        const ambulancesToCreate = [];
        createdHospitals.forEach((hospital, idx) => {
            for (let i = 0; i < 2; i++) {
                ambulancesToCreate.push({
                    hospital: hospital._id,
                    hospitalName: hospital.name,
                    vehicleNumber: `TS-${String(10 + idx).padStart(2, '0')}-AB-${String(1000 + idx * 2 + i)}`,
                    status: 'available',
                    currentLocation: { lat: hospital.location.lat, lng: hospital.location.lng },
                    driverName: `Driver ${idx * 2 + i + 1}`,
                    driverPhone: `+91-98765${String(50000 + idx * 2 + i).padStart(5, '0')}`,
                    type: i === 0 ? 'ALS' : 'BLS'
                });
            }
        });
        const createdAmbulances = await Ambulance.insertMany(ambulancesToCreate);
        console.log(`Created ${createdAmbulances.length} ambulances`);

        // Create demo users
        const salt = await bcrypt.genSalt(10);
        const demoUsers = [
            {
                name: 'Demo Patient',
                email: 'patient@demo.com',
                password: await bcrypt.hash('password123', salt),
                role: 'patient',
                phone: '+91-9999900001',
                location: { lat: 17.3850, lng: 78.4867 }
            },
            {
                name: 'Dr. Priya Sharma',
                email: 'doctor@demo.com',
                password: await bcrypt.hash('password123', salt),
                role: 'doctor',
                phone: '+91-9999900002',
                location: { lat: 17.4399, lng: 78.4983 }
            },
            {
                name: 'Hospital Admin',
                email: 'admin@demo.com',
                password: await bcrypt.hash('password123', salt),
                role: 'admin',
                phone: '+91-9999900003',
                location: { lat: 17.3750, lng: 78.4800 }
            }
        ];
        const createdUsers = await User.insertMany(demoUsers);
        console.log(`Created ${createdUsers.length} demo users`);

        const demoDoctorUser = createdUsers.find((user) => user.role === 'doctor');
        const seededDoctor = await Doctor.findOne({ name: demoDoctorUser.name });
        if (seededDoctor) {
            seededDoctor.user = demoDoctorUser._id;
            await seededDoctor.save();
        }


        console.log('No pre-seeded slots — doctors will create their own availability from their dashboard.');

        console.log('\n--- Demo Credentials ---');
        console.log('Patient: patient@demo.com / password123');
        console.log('Doctor:  doctor@demo.com / password123');
        console.log('Admin:   admin@demo.com / password123');
        console.log('------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedDB();
