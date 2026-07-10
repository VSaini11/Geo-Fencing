require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');

// --- PUSH NOTIFICATION UTILITY ---
async function sendPushNotification(pushToken, title, body, data = {}) {
    if (!pushToken) return;

    const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        const receipt = await response.json();
        console.log("Push notification sent:", receipt);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}
// ---------------------------------

const app = express();
app.use(cors());
app.use(express.json());

// Keep-alive health check — pinged every 5 minutes by cron-job.org to prevent
// the Catalyst AppSail free tier from sleeping (which causes wrong check-in timestamps
// in the mobile app because the background task's API calls fail during cold start).
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), ts: Date.now() });
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

if (!MONGO_URI) {
    console.warn("WARNING: MONGO_URI is not set in .env file.");
} else {
    mongoose.connect(MONGO_URI)
        .then(async () => {
            console.log('✅ Connected to MongoDB successfully');

            // Auto-seed a default admin account if none exists to prevent lockout
            try {
                const adminExists = await User.findOne({ role: 'admin' });
                if (!adminExists) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash('admin123', salt);
                    await User.create({
                        name: 'admin',
                        password: hashedPassword,
                        role: 'admin'
                    });
                    console.log('✅ Default admin account created (username: admin, password: admin123)');
                }
            } catch (err) {
                console.error('Failed to seed default admin:', err);
            }
        })
        .catch(err => console.error('❌ MongoDB connection error:', err));
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Admin Only Middleware
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access Denied: Requires Admin role' });
    }
};

// --- ROUTES ---

// Health check
app.get('/api/status', (req, res) => {
    res.json({ status: 'Server is running', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, password, role } = req.body;

        if (!name || !password || !role) {
            return res.status(400).json({ message: 'Name, password, and role are required' });
        }

        if (role === 'admin') {
            return res.status(403).json({ message: 'Admin registration is disabled. Please login with existing admin credentials.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user object
        const userData = {
            name,
            password: hashedPassword,
            role
        };

        // If employee, generate a random ID
        if (role === 'employee') {
            userData.employeeId = 'EMP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        }

        const newUser = new User(userData);
        await newUser.save();

        // Generate token
        const token = jwt.sign(
            { id: newUser._id, name: newUser.name, role: newUser.role, employeeId: newUser.employeeId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                role: newUser.role,
                employeeId: newUser.employeeId
            }
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { name, password, role } = req.body;

        const user = await User.findOne({ name, role });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials or role' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, name: user.name, role: user.role, employeeId: user.employeeId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                employeeId: user.employeeId
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
});

// Get all employees (Admin Only)
app.get('/api/users/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' }).select('-password');
        res.json(employees);
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: 'Failed to fetch employees' });
    }
});

// Update Push Token for logged-in user
app.post('/api/users/push-token', authenticateToken, async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) {
            return res.status(400).json({ message: 'Push token is required' });
        }

        await User.findByIdAndUpdate(req.user.id, { pushToken });
        res.json({ message: 'Push token updated successfully' });
    } catch (error) {
        console.error("Error saving push token:", error);
        res.status(500).json({ message: 'Failed to update push token' });
    }
});

// Delete an employee (Admin Only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.id);
        if (!userToDelete) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (userToDelete.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete an admin' });
        }

        // Cascade delete their checkins and daily logs to prevent orphaned data on UI
        await CheckIn.deleteMany({ userName: userToDelete.name });
        await DailyLog.deleteMany({ userName: userToDelete.name });

        // Finally delete the user
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'Employee and all associated records deleted successfully' });
    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).json({ message: 'Failed to delete employee' });
    }
});

// Generic Data Route (from earlier, updated to be protected)
const Location = require('./models/Location');
const CheckIn = require('./models/CheckIn');
const DailyLog = require('./models/DailyLog');

// --- LOCATIONS ---
app.get('/api/locations', authenticateToken, async (req, res) => {
    try {
        const locations = await Location.find().sort({ createdAt: -1 });
        res.json(locations);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch locations', error: error.message });
    }
});

app.post('/api/locations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, latitude, longitude, radiusMeters, assignedEmployees } = req.body;
        if (!name || latitude === undefined || longitude === undefined || !radiusMeters) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const newLocation = new Location({ name, latitude, longitude, radiusMeters, assignedEmployees: assignedEmployees || [] });
        await newLocation.save();
        res.status(201).json(newLocation);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create location', error: error.message });
    }
});

app.put('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, latitude, longitude, radiusMeters, assignedEmployees } = req.body;
        const location = await Location.findById(req.params.id);
        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }
        if (name) location.name = name;
        if (latitude !== undefined) location.latitude = latitude;
        if (longitude !== undefined) location.longitude = longitude;
        if (radiusMeters) location.radiusMeters = radiusMeters;
        if (assignedEmployees) location.assignedEmployees = assignedEmployees;

        await location.save();
        res.json(location);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update location', error: error.message });
    }
});

app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await Location.findByIdAndDelete(req.params.id);
        res.json({ message: 'Location deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete location', error: error.message });
    }
});

// --- CHECK-INS ---
app.get('/api/checkins', authenticateToken, async (req, res) => {
    try {
        // If admin, return all checkins. If employee, return only theirs.
        const query = req.user.role === 'admin' ? {} : { userName: req.user.name };
        const checkins = await CheckIn.find(query).sort({ checkInAt: -1 });
        res.json(checkins);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch check-ins', error: error.message });
    }
});

app.post('/api/checkins', authenticateToken, async (req, res) => {
    try {
        const receivedTime = new Date().toISOString();
        console.log(`\n======================================================`);
        console.log(`[START] Check-In Request Received at: ${receivedTime}`);
        console.log(`[USER]  ${req.user.name}`);
        console.log(`[BODY]  Payload:`, req.body);

        const { locationId, latitude, longitude, timestamp } = req.body;
        if (!locationId || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        // Idempotency guard: if user already has an active check-in (e.g. BG task already
        // checked them in while app was closed), return it instead of creating a duplicate.
        const existingActive = await CheckIn.findOne({
            userName: req.user.name,
            status: 'active'
        });
        if (existingActive) {
            console.log(`[CheckIn] User ${req.user.name} already has active check-in, returning existing.`);
            return res.status(200).json(existingActive);
        }

        const newCheckIn = new CheckIn({
            locationId,
            userName: req.user.name,
            status: 'active',
            lastLatitude: latitude,
            lastLongitude: longitude,
            // Use the client-provided GPS timestamp if given (background task sends real arrival
            // time). Fall back to server clock for foreground check-ins that omit it.
            checkInAt: timestamp ? new Date(timestamp) : new Date(),
        });
        await newCheckIn.save();

        // DAILY LOG LOGIC - ENTER
        // Use the same timestamp so logs match the check-in record exactly.
        const now = timestamp ? new Date(timestamp) : new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        let dailyLog = await DailyLog.findOne({ userName: req.user.name, date: dateStr });

        let newFlags = [];
        // ONLY check for late check-in or half-day if this is the FIRST check-in of the day
        if (!dailyLog) {
            const location = await Location.findById(locationId);
            if (location) {
                const [sh, sm] = (location.shiftStart || '09:00').split(':').map(Number);
                const shiftStartTime = new Date(now).setHours(sh, sm, 0, 0);
                const graceTime = shiftStartTime + (30 * 60000); // 9:30 AM

                const [lh, lm] = (location.lunchStart || '12:00').split(':').map(Number);
                const [le, lme] = (location.lunchEnd || '13:00').split(':').map(Number);
                const lunchStartTime = new Date(now).setHours(lh, lm, 0, 0);
                const lunchEndTime = new Date(now).setHours(le, lme, 0, 0);

                if (now.getTime() >= lunchStartTime && now.getTime() <= lunchEndTime) {
                    newFlags.push('lunch_half_day');
                } else if (now.getTime() > graceTime) {
                    newFlags.push('late_checkin');
                } else if (now.getTime() < shiftStartTime) {
                    newFlags.push('early_checkin');
                }
            }

            dailyLog = new DailyLog({
                userName: req.user.name,
                date: dateStr,
                firstCheckIn: now,
                events: [],
                flags: newFlags
            });
        }

        dailyLog.events.push({
            time: now,
            type: 'enter',
            tag: 'active',
            coords: { latitude, longitude }
        });

        await dailyLog.save();

        // TRIGGER PUSH NOTIFICATION
        const user = await User.findOne({ name: req.user.name });
        if (user && user.pushToken) {
            const loc = await Location.findById(locationId);
            sendPushNotification(
                user.pushToken,
                "Checked In ✅",
                `You have successfully checked in at ${loc ? loc.name : 'the job site'}.`
            );
        }

        const completedTime = new Date().toISOString();
        console.log(`[END]   Check-In Processed & Saved successfully at: ${completedTime}`);
        console.log(`[DB RECORD] Time saved to DB and sent to app (checkInAt): ${newCheckIn.checkInAt}`);
        console.log(`======================================================\n`);

        res.status(201).json(newCheckIn);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create check-in', error: error.message });
    }
});

app.post('/api/checkins/:id/ping', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        let checkIn;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            checkIn = await CheckIn.findOne({ userName: req.user.name, status: 'active' }).sort({ checkInAt: -1 });
        } else {
            checkIn = await CheckIn.findById(req.params.id);
        }
        if (!checkIn) return res.status(404).json({ message: 'Check-in not found' });

        // Allow admin or the owner
        if (req.user.role !== 'admin' && checkIn.userName !== req.user.name) {
            return res.status(403).json({ message: 'Access Denied' });
        }

        checkIn.lastLatitude = latitude;
        checkIn.lastLongitude = longitude;
        checkIn.lastPingAt = Date.now();
        await checkIn.save();

        res.json(checkIn);
    } catch (error) {
        res.status(500).json({ message: 'Failed to ping check-in', error: error.message });
    }
});

app.post('/api/checkins/:id/checkout', authenticateToken, async (req, res) => {
    try {
        const receivedTime = new Date().toISOString();
        console.log(`\n======================================================`);
        console.log(`[START] Check-Out Request Received at: ${receivedTime}`);
        console.log(`[USER]  ${req.user.name} | [CHECK-IN ID] ${req.params.id}`);
        console.log(`[BODY]  Payload:`, req.body);

        const { latitude, longitude, timestamp } = req.body;
        
        let checkIn;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.log(`[Checkout] Invalid check-in ID format: ${req.params.id}. Falling back to active check-in.`);
            checkIn = await CheckIn.findOne({ userName: req.user.name, status: 'active' }).sort({ checkInAt: -1 });
        } else {
            checkIn = await CheckIn.findById(req.params.id);
        }
        if (!checkIn) return res.status(404).json({ message: 'Check-in not found' });

        // Allow admin or the owner
        if (req.user.role !== 'admin' && checkIn.userName !== req.user.name) {
            return res.status(403).json({ message: 'Access Denied' });
        }

        const checkoutTime = timestamp ? new Date(timestamp) : new Date();

        // Idempotency guard: if already checked out, return the existing record without
        // creating a duplicate EXIT event in the daily log.
        if (checkIn.status === 'completed') {
            console.log(`[Checkout] Check-in ${req.params.id} already completed, skipping duplicate.`);
            return res.json(checkIn);
        }

        checkIn.status = 'completed';
        checkIn.checkOutAt = checkoutTime;
        if (latitude !== undefined) checkIn.lastLatitude = latitude;
        if (longitude !== undefined) checkIn.lastLongitude = longitude;

        await checkIn.save();

        // DAILY LOG LOGIC - EXIT
        const now = checkoutTime;
        const dateStr = now.toISOString().split('T')[0];
        const dailyLog = await DailyLog.findOne({ userName: checkIn.userName, date: dateStr });

        if (dailyLog) {
            const location = await Location.findById(checkIn.locationId);
            let tag = 'unscheduled';

            if (location) {
                const [lh, lm] = (location.lunchStart || '12:00').split(':').map(Number);
                const [le, lme] = (location.lunchEnd || '13:00').split(':').map(Number);
                const [sh, sm] = (location.shiftEnd || '18:00').split(':').map(Number);

                const lunchStartTime = new Date(now).setHours(lh, lm, 0, 0);
                const lunchEndTime = new Date(now).setHours(le, lme, 0, 0);
                const shiftEndTime = new Date(now).setHours(sh, sm, 0, 0);

                if (now.getTime() >= lunchStartTime && now.getTime() <= lunchEndTime) {
                    tag = 'lunch';
                } else if (Math.abs(now.getTime() - shiftEndTime) < 3600000) { // within 1 hr of shift end
                    tag = 'shift_end';
                }
            }

            dailyLog.events.push({
                time: now,
                type: 'exit',
                tag: tag,
                coords: { latitude: checkIn.lastLatitude, longitude: checkIn.lastLongitude }
            });
            dailyLog.lastCheckOut = now;

            // Recalculate raw minutes for all check-in/check-out spans
            let worked = 0;
            let lunch = 0;
            let unscheduled = 0;
            let lastEnter = null;

            for (const ev of dailyLog.events) {
                if (ev.type === 'enter') {
                    lastEnter = ev.time;
                } else if (ev.type === 'exit' && lastEnter) {
                    let enterTime = new Date(lastEnter).getTime();
                    let exitTime = new Date(ev.time).getTime();

                    if (exitTime > enterTime) {
                        const mins = Math.floor((exitTime - enterTime) / 60000);
                        worked += mins;
                    }
                    lastEnter = null;
                }
            }

            let lastExit = null;
            let lastExitTag = null;

            for (const ev of dailyLog.events) {
                if (ev.type === 'exit') {
                    lastExit = ev.time;
                    lastExitTag = ev.tag;
                } else if (ev.type === 'enter' && lastExit) {
                    const gapMins = Math.floor((ev.time - lastExit) / 60000);
                    if (lastExitTag === 'lunch') lunch += gapMins;
                    else if (lastExitTag === 'unscheduled') unscheduled += gapMins;
                    lastExit = null;
                }
            }

            dailyLog.workedMinutes = worked;
            dailyLog.lunchMinutes = lunch;
            dailyLog.unscheduledMinutes = unscheduled;

            // Half-day tagging based on < 8 hours (480 minutes)
            if (dailyLog.workedMinutes < 480) {
                if (!dailyLog.flags.includes('short_hours_half_day')) {
                    dailyLog.flags.push('short_hours_half_day');
                }
            } else {
                // Automatically remove the flag if they eventually hit 8 hours during a later check-out!
                dailyLog.flags = dailyLog.flags.filter(f => f !== 'short_hours_half_day');
            }

            await dailyLog.save();
        }

        // TRIGGER PUSH NOTIFICATION
        const user = await User.findOne({ name: checkIn.userName });
        if (user && user.pushToken) {
            const loc = await Location.findById(checkIn.locationId);
            sendPushNotification(
                user.pushToken,
                "Checked Out 🛑",
                `You have successfully checked out from ${loc ? loc.name : 'the job site'}.`
            );
        }

        const completedTime = new Date().toISOString();
        console.log(`[END]   Check-Out Processed & Saved successfully at: ${completedTime}`);
        console.log(`[DB RECORD] Time saved to DB and sent to app (checkOutAt): ${checkIn.checkOutAt}`);
        console.log(`======================================================\n`);

        res.json(checkIn);
    } catch (error) {
        res.status(500).json({ message: 'Failed to checkout', error: error.message });
    }
});

// Generic Data Route (from earlier, updated to be protected)
const AppData = mongoose.model('AppData', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }
}));

app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        const newData = new AppData({
            userId: req.user.id,
            data: req.body
        });
        const savedData = await newData.save();
        res.status(201).json({ success: true, message: 'Data saved to MongoDB', record: savedData });
    } catch (error) {
        console.error("Error saving data:", error);
        res.status(500).json({ success: false, message: 'Failed to save data' });
    }
});

// --- DAILY LOGS ---
app.get('/api/dailylogs', authenticateToken, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { userName: req.user.name };
        const logs = await DailyLog.find(query).sort({ date: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch daily logs', error: error.message });
    }
});

const functions = require("firebase-functions");
exports.api = functions.https.onRequest(app);

