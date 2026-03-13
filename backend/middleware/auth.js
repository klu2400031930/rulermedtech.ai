const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rural-health-secret-key-2024';

const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Role ${req.user.role} is not authorized` });
        }
        next();
    };
};

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id || user.id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
};

module.exports = { protect, authorize, generateToken, JWT_SECRET };
