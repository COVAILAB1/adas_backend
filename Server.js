const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const bodyParser = require('body-parser');

const app = express();

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(helmet());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting

// MongoDB connection
mongoose.connect('mongodb+srv://covailabs1:dpBIwF4ZZcJQkgjA@cluster0.jr1ju8f.mongodb.net/driver_assist?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  logger.error('MongoDB connection error:', err);
});

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  full_name: { type: String, required: true },
  email: { type: String, required: true },
  score: { type: Number, default: 100, min: 0, max: 100 },
  car_name: { type: String, required: true },
  car_number: { type: String, required: true },
  obd_name: { type: String, required: true },
  bluetooth_mac: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
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
  total_distance: { type: Number, required: true },
  timestamp: { type: Date, required: true }
});

// Updated event schema - removed speed fields
const eventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event_type: { type: String, required: true },
  event_description: { type: String, required: true },
  timestamp: { type: Date, required: true },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 }
});

// New speed schema for separate collection
const speedSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   speed_obd: { type: Number, required: false, default: 0 }, // Made optional with default
  speed_gps: { type: Number, required: false, default: 0 },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, required: true, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Location = mongoose.model('Location', locationSchema);
const Event = mongoose.model('Event', eventSchema);
const Speed = mongoose.model('Speed', speedSchema);

// Authentication middleware for admin routes
11.0171035
76.9644485

app.get('/api/get_users', async (req, res) => {
  try {
    const users = await User.find({}, 'id username full_name email score car_name car_number obd_name bluetooth_mac');
    res.json({ success: true, users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(req.body);
    if (!username || !password) {
      logger.warn('Missing username or password in login attempt');
      return res.status(400).json({ success: false, error: 'Missing username or password' });
    }

    const user = await User.findOne({ username, password });
    if (!user) {
      logger.warn(`Invalid login attempt for username: ${username}`);
      return res.json({ success: false, error: 'Invalid credentials' })
    }

    res.json({ 
      success: true, 
      user: { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/add_user', async (req, res) => {
  try {
    const {
      username,
      password,
      role,
      full_name,
      email,
      car_name,
      car_number,
      obd_name,
      bluetooth_mac
    } = req.body;

    if (!username || !password || !full_name || !email || !car_name || !car_number || !obd_name || !bluetooth_mac) {
      logger.warn('Invalid user data received');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      logger.warn(`Username already exists: ${username}`);
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const user = new User({
      username,
      password, // In production, hash the password using bcrypt
      role,
      full_name,
      email,
      car_name,
      car_number,
      obd_name,
      bluetooth_mac
    });

    await user.save();
    res.status(200).json({ success: true, message: 'User added successfully' });
  } catch (error) {
    logger.error('Error adding user:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update user
app.put('/api/update_user', async (req, res) => {
  try {
    const {
      id,
      username,
      full_name,
      email,
      car_name,
      car_number,
      obd_name,
      bluetooth_mac
    } = req.body;
    console.log(req.body);

    if (!id || !username || !full_name || !email || !car_name || !car_number || !obd_name || !bluetooth_mac) {
      logger.warn('Invalid user data received for update');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const user = await User.findById(id);
    if (!user) {
      logger.warn(`User not found for update: ${id}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existingUser = await User.findOne({ username, _id: { $ne: id } });
    if (existingUser) {
      logger.warn(`Username already exists: ${username}`);
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    user.username = username;
    user.full_name = full_name;
    user.email = email;
    user.car_name = car_name;
    user.car_number = car_number;
    user.obd_name = obd_name;
    user.bluetooth_mac = bluetooth_mac;

    await user.save();
    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Insert location data
app.post('/api/location', async (req, res) => {
  try {
    const { user_id, start_location, end_location, traveled_path, total_distance, timestamp } = req.body;

    if (!user_id || !start_location || !end_location || !traveled_path || total_distance == null) {
      logger.warn('Invalid location data received');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const location = new Location({
      user_id,
      start_location,
      end_location,
      traveled_path,
      total_distance,
      timestamp: new Date(timestamp)
    });

    await location.save();
    res.status(200).json({ success: true, message: 'Location data saved' });
  } catch (error) {
    logger.error('Error saving location data:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }

});

// POST /api/speed endpoint
app.post('/api/speed', async (req, res) => {
  try {
    const { user_id, speed_data } = req.body;
    console.log(req.body);

    // Validate request body
    if (!user_id || !speed_data || !Array.isArray(speed_data) || speed_data.length === 0) {
      logger.warn('Invalid speed data received');
      return res.status(400).json({ success: false, error: 'Missing or invalid required fields' });
    }

    // Process each speed data entry
    const speedEntries = speed_data.map(data => {
      const { latitude, longitude, speed, speed_obd, speed_gps, speed_source, timestamp } = data;

      // Validate required fields
      if (latitude == null || longitude == null || speed == null || !speed_source) {
        throw new Error('Missing required fields in speed data entry');
      }

      // Map speed data, using provided values or defaults
      const speedEntry = {
        user_id,
        speed_obd: speed_obd != null ? speed_obd : (speed_source === 'OBD' ? speed : 0),
        speed_gps: speed_gps != null ? speed_gps : (speed_source === 'GPS' ? speed : 0),
        latitude,
        longitude,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        speed_source
      };

      return speedEntry;
    });

    // Insert all valid entries into the database
    const savedSpeeds = await Speed.insertMany(speedEntries);

    res.status(200).json({
      success: true,
      message: 'Speed data saved',
      speed_ids: savedSpeeds.map(speed => speed._id)
    });
  } catch (error) {
    logger.error('Error saving speed data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Updated event logging - removed speed fields
app.post('/api/log_event', async (req, res) => {
  try {
    const { user_id, event_type, event_description, timestamp, latitude, longitude } = req.body;

    if (!user_id || !event_type || !event_description || !timestamp) {
      logger.warn('Invalid event data received');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const event = new Event({
      user_id,
      event_type,
      event_description,
      timestamp: new Date(timestamp),
      latitude: latitude || 0,
      longitude: longitude || 0
    });

    await event.save();

    // Driver performance score calculation
    let scoreChange = 0;
    switch (event_type) {
      case 'sudden_acceleration':
        scoreChange = -5; // Penalty for sudden acceleration
        break;
      case 'sudden_braking':
        scoreChange = -2; // Penalty for sudden braking
        break;
      case 'speed_limit_violation':
        scoreChange = -4; // Higher penalty for exceeding speed limit
        break;
      case 'collision_warning':
        scoreChange = -5; // Severe penalty for potential collision
        break;
      case 'safe_driving':
        scoreChange = 2; // Reward for safe driving behavior
        break;
      default:
        scoreChange = 0; // No change for other events
    }

    // Update user score with bounds checking
    if (scoreChange !== 0) {
      const user = await User.findById(user_id);
      if (user) {
        // Calculate new score with bounds checking (0-100)
        const currentScore = user.score || 50; // Default to 50 if no score exists
        const newScore = Math.max(0, Math.min(100, currentScore + scoreChange));
        
        user.score = newScore;
        await user.save();
        
        logger.info(`User ${user_id} score updated: ${currentScore} -> ${newScore} (change: ${scoreChange})`);
      } else {
        logger.warn(`User not found for score update: ${user_id}`);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Event logged',
      event_id: event._id,
      score_change: scoreChange
    });
  } catch (error) {
    logger.error('Error logging event:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Updated get user details without speed data
app.get('/api/get_user_details', async (req, res) => {
  try {
    const { user_id, date } = req.query;
    console.log(req.query);

    if (!user_id) {
      logger.warn('Missing user_id in get_user_details');
      return res.status(400).json({ success: false, error: 'Missing user_id' });
    }

    const user = await User.findById(user_id, 'username full_name email score car_name car_number obd_name bluetooth_mac');
    if (!user) {
      logger.warn(`User not found: ${user_id}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let query = { user_id };
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);

      query.timestamp = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }

    const [locations, event_logs] = await Promise.all([
      Location.find(query).lean(),
      Event.find(query).lean()
    ]);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        id: user._id,
        locations: locations,
        event_logs: event_logs
      }
    });
  } catch (error) {
    logger.error('Error fetching user details:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// New API to get speed data
app.get('/api/get_speed_data', async (req, res) => {
  try {
    const { user_id, date } = req.query;
    console.log(req.query);

    if (!user_id) {
      logger.warn('Missing user_id in get_speed_data');
      return res.status(400).json({ success: false, error: 'Missing user_id' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      logger.warn(`User not found: ${user_id}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let query = { user_id };
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(startOfDay.getDate() + 1);

      query.timestamp = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }

    const speed_data = await Speed.find(query).lean();

    res.json({
      success: true,
      speed_data: speed_data
    });
  } catch (error) {
    logger.error('Error fetching speed data:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});