const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://covailabs1:dpBIwF4ZZcJQkgjA@cluster0.jr1ju8f.mongodb.net/driver_assist?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In production, use proper hashing
    role: { type: String, default: 'user' },
    full_name: String,
    email: String
});

const carDetailsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    car_name: String,
    car_number: String,
    obd_name: String,
    bluetooth_mac: String
});

const driverScoreSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, default: 100 },
    last_updated: { type: Date, default: Date.now }
});

const eventLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event_type: String,
    event_description: String,
    latitude: { type: Number, default: 0.0 },
    longitude: { type: Number, default: 0.0 },
    speed_obd: { type: Number, default: 0.0 },
    speed_gps: { type: Number, default: 0.0 },
    timestamp: { type: Date, default: Date.now }
});

const locationSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    end_location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    traveled_path: [{
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    }],
    total_distance: { type: Number, required: true }, // Distance in kilometers
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const CarDetails = mongoose.model('CarDetails', carDetailsSchema);
const DriverScore = mongoose.model('DriverScore', driverScoreSchema);
const EventLog = mongoose.model('EventLog', eventLogSchema);
const Location = mongoose.model('Location', locationSchema);

// API Routes
app.post('/api/:action', async (req, res) => {
    const { action } = req.params;
    const input = req.body;
    console.log(input);

    try {
        switch (action) {
            case 'login': {
                const { username: loginUsername, password: loginPassword } = input;
                const user = await User.findOne({ username: loginUsername, password: loginPassword });
                if (user) {
                    res.json({ success: true, user: { id: user._id, username: user.username, role: user.role } });
                } else {
                    res.json({ success: false, error: 'Invalid credentials' });
                }
                break;
            }

            case 'add_user': {
                const {
                    username: addUsername,
                    password: addPassword,
                    role = 'user',
                    full_name,
                    email,
                    car_name,
                    car_number,
                    obd_name,
                    bluetooth_mac
                } = input;
                const newUser = await User.create({ username: addUsername, password: addPassword, role, full_name, email });

                if (role === 'user') {
                    await CarDetails.create({ user_id: newUser._id, car_name, car_number, obd_name, bluetooth_mac });
                    await DriverScore.create({ user_id: newUser._id, score: 100 });
                }
                res.json({ success: true });
                break;
            }

            case 'log_event': {
                const { user_id, event_type, event_description, latitude, longitude, speed_obd, speed_gps } = input;
                await EventLog.create({
                    user_id,
                    event_type,
                    event_description,
                    latitude: latitude || 0.0,
                    longitude: longitude || 0.0,
                    speed_obd: speed_obd || 0.0,
                    speed_gps: speed_gps || 0.0
                });

                // Update driver score
                const score_change = (event_type === 'speed_limit_violation' || event_type === 'collision_warning' ||
                                     event_type === 'sudden_acceleration' || event_type === 'sudden_braking') ? -5 : 0;
                await DriverScore.updateOne(
                    { user_id },
                    { $inc: { score: score_change }, $set: { last_updated: new Date() } },
                    { min: { score: 0 } }
                );
                res.json({ success: true });
                break;
            }

            default:
                res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/location', async (req, res) => {
    const { user_id, start_location, end_location, traveled_path, total_distance } = req.body;

    try {
        if (!user_id || !start_location || !end_location || !traveled_path || total_distance == null) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await Location.create({
            user_id,
            start_location: {
                latitude: start_location.latitude,
                longitude: start_location.longitude
            },
            end_location: {
                latitude: end_location.latitude,
                longitude: end_location.longitude
            },
            traveled_path: traveled_path.map(point => ({
                latitude: point.latitude,
                longitude: point.longitude
            })),
            total_distance
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving location data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/:action', async (req, res) => {
    const { action } = req.params;
    const { user_id } = req.query;

    try {
        switch (action) {
            case 'get_users':
                const users = await User.aggregate([
                    { $match: { role: 'user' } },
                    {
                        $lookup: {
                            from: 'cardetails',
                            localField: '_id',
                            foreignField: 'user_id',
                            as: 'car_details'
                        }
                    },
                    {
                        $lookup: {
                            from: 'driverscores',
                            localField: '_id',
                            foreignField: 'user_id',
                            as: 'driver_scores'
                        }
                    },
                    {
                        $lookup: {
                            from: 'eventlogs',
                            localField: '_id',
                            foreignField: 'user_id',
                            as: 'event_logs'
                        }
                    },
                    {
                        $lookup: {
                            from: 'locations',
                            localField: '_id',
                            foreignField: 'user_id',
                            as: 'locations'
                        }
                    },
                    {
                        $project: {
                            id: '$_id',
                            username: 1,
                            role: 1,
                            full_name: 1,
                            email: 1,
                            car_name: { $arrayElemAt: ['$car_details.car_name', 0] },
                            car_number: { $arrayElemAt: ['$car_details.car_number', 0] },
                            obd_name: { $arrayElemAt: ['$car_details.obd_name', 0] },
                            bluetooth_mac: { $arrayElemAt: ['$car_details.bluetooth_mac', 0] },
                            score: { $arrayElemAt: ['$driver_scores.score', 0] },
                            event_logs: {
                                $map: {
                                    input: '$event_logs',
                                    as: 'event',
                                    in: {
                                        event_type: '$$event.event_type',
                                        event_description: '$$event.event_description',
                                        latitude: '$$event.latitude',
                                        longitude: '$$event.longitude',
                                        speed_obd: '$$event.speed_obd',
                                        speed_gps: '$$event.speed_gps',
                                        timestamp: '$$event.timestamp'
                                    }
                                }
                            },
                            locations: {
                                $map: {
                                    input: '$locations',
                                    as: 'location',
                                    in: {
                                        start_location: '$$location.start_location',
                                        end_location: '$$location.end_location',
                                        traveled_path: '$$location.traveled_path',
                                        total_distance: '$$location.total_distance',
                                        timestamp: '$$location.timestamp'
                                    }
                                }
                            }
                        }
                    }
                ]);
                res.json({ success: true, users });
                break;

            case 'get_events':
                const events = await EventLog.find({ user_id })
                    .select('event_type event_description latitude longitude speed_obd speed_gps timestamp')
                    .sort({ timestamp: -1 });
                res.json({ success: true, events });
                break;

            default:
                res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/get_user_details', async (req, res) => {
    const { user_id, date } = req.query;

    try {
        if (!user_id) {
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }

        const matchStage = { _id: new mongoose.Types.ObjectId(user_id), role: 'user' };
        const eventMatch = { user_id: new mongoose.Types.ObjectId(user_id) };
        const locationMatch = { user_id: new mongoose.Types.ObjectId(user_id) };

        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);

            eventMatch.timestamp = { $gte: startDate, $lt: endDate };
            locationMatch.timestamp = { $gte: startDate, $lt: endDate };
        }

        const user = await User.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'cardetails',
                    localField: '_id',
                    foreignField: 'user_id',
                    as: 'car_details'
                }
            },
            {
                $lookup: {
                    from: 'driverscores',
                    localField: '_id',
                    foreignField: 'user_id',
                    as: 'driver_scores'
                }
            },
            {
                $lookup: {
                    from: 'eventlogs',
                    let: { user_id: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [eventMatch] } } },
                        { $sort: { timestamp: -1 } }
                    ],
                    as: 'event_logs'
                }
            },
            {
                $lookup: {
                    from: 'locations',
                    let: { user_id: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [locationMatch] } } },
                        { $sort: { timestamp: -1 } }
                    ],
                    as: 'locations'
                }
            },
            {
                $project: {
                    id: '$_id',
                    username: 1,
                    role: 1,
                    full_name: 1,
                    email: 1,
                    car_name: { $arrayElemAt: ['$car_details.car_name', 0] },
                    car_number: { $arrayElemAt: ['$car_details.car_number', 0] },
                    obd_name: { $arrayElemAt: ['$car_details.obd_name', 0] },
                    bluetooth_mac: { $arrayElemAt: ['$car_details.bluetooth_mac', 0] },
                    score: { $arrayElemAt: ['$driver_scores.score', 0] },
                    event_logs: {
                        $map: {
                            input: '$event_logs',
                            as: 'event',
                            in: {
                                event_type: '$$event.event_type',
                                event_description: '$$event.event_description',
                                latitude: '$$event.latitude',
                                longitude: '$$event.longitude',
                                speed_obd: '$$event.speed_obd',
                                speed_gps: '$$event.speed_gps',
                                timestamp: '$$event.timestamp'
                            }
                        }
                    },
                    locations: {
                        $map: {
                            input: '$locations',
                            as: 'location',
                            in: {
                                start_location: '$$location.start_location',
                                end_location: '$$location.end_location',
                                traveled_path: '$$location.traveled_path',
                                total_distance: '$$location.total_distance',
                                timestamp: '$$event.timestamp'
                            }
                        }
                    }
                }
            }
        ]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user: user[0] });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/:action', async (req, res) => {
    const { action } = req.params;
    const input = req.body;

    try {
        if (action === 'update_user') {
            const { id, username, full_name, email, car_name, car_number, obd_name, bluetooth_mac } = input;
            await User.updateOne({ _id: id }, { username, full_name, email });
            await CarDetails.updateOne(
                { user_id: id },
                { car_name, car_number, obd_name, bluetooth_mac }
            );
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});