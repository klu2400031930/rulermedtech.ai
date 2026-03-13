const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const AmbulanceTracker = require('./socket/ambulanceTracker');

// Load env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Ambulance GPS tracker
const ambulanceTracker = new AmbulanceTracker(io);

// Connect SMS service to Socket.IO for in-app notifications
const smsService = require('./services/smsService');
smsService.setSocketIO(io);
console.log('SMS provider status:', smsService.getProviderStatus());

// Make io and tracker available to routes
app.set('io', io);
app.set('ambulanceTracker', ambulanceTracker);

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/diagnosis', require('./routes/diagnosis'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'Rural Health Backend', timestamp: new Date().toISOString() });
});

// SMS log endpoint
app.get('/api/sms/recent', (req, res) => {
    const smsService = require('./services/smsService');
    res.json(smsService.getRecentMessages());
});

// Socket.IO
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('ambulance:location', (data) => {
        io.emit('ambulance:location', data);
    });

    socket.on('ambulance:eta', (data) => {
        io.emit('ambulance:eta', data);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`REST API: http://localhost:${PORT}/api`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
});
