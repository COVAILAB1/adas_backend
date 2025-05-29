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
mongoose.connect('mongodb://localhost:27017/driver_assist', {
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
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const CarDetails = mongoose.model('CarDetails', carDetailsSchema);
const DriverScore = mongoose.model('DriverScore', driverScoreSchema);
const EventLog = mongoose.model('EventLog', eventLogSchema);

// API Routes
app.post('/api/:action', async (req, res) => {
    const { action } = req.params;
    const input = req.body;
    console.log(input)

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
                const { user_id, event_type, event_description } = input;
                await EventLog.create({ user_id, event_type, event_description });
                
                // Update driver score
                const score_change = (event_type === 'speeding' || event_type === 'collision') ? -5 : 0;
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
                            score: { $arrayElemAt: ['$driver_scores.score', 0] }
                        }
                    }
                ]);
                res.json({ success: true, users });
                break;

            case 'get_events':
                const events = await EventLog.find({ user_id })
                    .select('event_type event_description timestamp')
                    .sort({ timestamp: -1 });
                res.json({ success: true, events });
                break;

            default:
                res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
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
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});