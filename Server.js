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
  trip_id: { type: String, required: true }, // Added trip_id for unique trip identification
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
  start_time: { type: Date, required: true }, // Added start_time
  stop_time: { type: Date, required: false }, // Added stop_time, optional for periodic sends
  timestamp: { type: Date, required: true },
  total_distance: { type: Number, required: true }
});
// Updated event schema - removed speed fields
const eventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trip_id: { type: String, required: true }, // Added trip_id
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
app.post('/api/location', async (req, res) => {
  try {
    const { user_id, trip_id, start_location, end_location, traveled_path, start_time, stop_time, timestamp, total_distance } = req.body;
    const logTimestamp = new Date().toISOString();
    logger.info(`[${logTimestamp}] Processing location data for user_id: ${user_id}, trip_id: ${trip_id}, start_time: ${start_time}, stop_time: ${stop_time}`);

    if (!user_id || !trip_id || !start_location || !end_location || !traveled_path || !start_time || total_distance == null || !timestamp) {
      logger.warn(`[${logTimestamp}] Missing required fields for location data: user_id=${user_id}, trip_id=${trip_id}, start_location=${JSON.stringify(start_location)}, end_location=${JSON.stringify(end_location)}, traveled_path=${traveled_path?.length}, start_time=${start_time}, total_distance=${total_distance}, timestamp=${timestamp}`);
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check for an existing document with the same trip_id and no stop_time (active trip)
    const existingLocation = await Location.findOne({ user_id, trip_id, stop_time: null });

    if (existingLocation) {
      // Update existing document
      existingLocation.end_location = end_location;
      existingLocation.traveled_path = traveled_path; // Replace with new cumulative path
      existingLocation.total_distance = parseFloat(total_distance);
      existingLocation.timestamp = new Date(timestamp);
      if (stop_time) {
        existingLocation.stop_time = new Date(stop_time); // Set stop_time if provided
      }
      const updatedLocation = await existingLocation.save();
      logger.info(`[${logTimestamp}] Updated location data for user_id: ${user_id}, trip_id: ${trip_id}, location_id: ${updatedLocation._id}, traveled_path_length: ${updatedLocation.traveled_path.length}`);
      return res.status(200).json({ success: true, location_id: updatedLocation._id });
    } else {
      // Create new document
      const location = new Location({
        user_id,
        trip_id,
        start_location,
        end_location,
        traveled_path,
        start_time: new Date(start_time),
        stop_time: stop_time ? new Date(stop_time) : null,
        timestamp: new Date(timestamp),
        total_distance: parseFloat(total_distance)
      });
      const savedLocation = await location.save();
      logger.info(`[${logTimestamp}] Created new location data for user_id: ${user_id}, trip_id: ${trip_id}, location_id: ${savedLocation._id}, traveled_path_length: ${savedLocation.traveled_path.length}`);
      return res.status(200).json({ success: true, location_id: savedLocation._id });
    }
  } catch (error) {
    logger.error(`[${logTimestamp}] Error processing location data for user_id: ${user_id}, trip_id: ${trip_id || 'unknown'}: ${error.message}`);
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

app.post('/api/log_event', async (req, res) => {
  try {
    const { user_id, trip_id, event_type, event_description, timestamp, latitude, longitude } = req.body;
    const logTimestamp = new Date().toISOString();
    logger.info(`[${logTimestamp}] Logging event for user_id: ${user_id}, trip_id: ${trip_id}, event_type: ${event_type}`);

    if (!user_id || !trip_id || !event_type || !event_description || !timestamp) {
      logger.warn(`[${logTimestamp}] Missing required fields for event: user_id=${user_id}, trip_id=${trip_id}, event_type=${event_type}, event_description=${event_description}, timestamp=${timestamp}`);
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const event = new Event({
      user_id,
      trip_id,
      event_type,
      event_description,
      timestamp: new Date(timestamp),
      latitude: parseFloat(latitude) || 0,
      longitude: parseFloat(longitude) || 0
    });

    const savedEvent = await event.save();

    // Driver performance score calculation
    let scoreChange = 0;
    switch (event_type) {
      case 'sudden_acceleration':
        scoreChange = -4;
        break;
      case 'sudden_braking':
        scoreChange = -2;
        break;
      case 'speed_limit_violation':
        scoreChange = -4;
        break;
      case 'collision_warning':
        scoreChange = -2;
        break;
      case 'safe_driving':
        scoreChange = 2;
        break;
      default:
        scoreChange = 0;
    }

    // Update user score with bounds checking
    if (scoreChange !== 0) {
      const user = await User.findById(user_id);
      if (user) {
        const currentScore = user.score || 50;
        const newScore = Math.max(0, Math.min(100, currentScore + scoreChange));
        user.score = newScore;
        await user.save();
        logger.info(`[${logTimestamp}] User ${user_id} score updated: ${currentScore} -> ${newScore} (change: ${scoreChange}) for trip_id: ${trip_id}`);
      } else {
        logger.warn(`[${logTimestamp}] User not found for score update: ${user_id}`);
      }
    }

    logger.info(`[${logTimestamp}] Event logged successfully for user_id: ${user_id}, trip_id: ${trip_id}, event_id: ${savedEvent._id}`);
    res.status(200).json({ 
      success: true, 
      message: 'Event logged',
      event_id: savedEvent._id,
      score_change: scoreChange
    });
  } catch (error) {
    logger.error(`[${logTimestamp}] Error logging event for user_id: ${user_id}, trip_id: ${trip_id || 'unknown'}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/get_user_details', async (req, res) => {
  try {
    const { user_id, date, trip_id } = req.query;
    logger.info(`[${new Date().toISOString()}] Fetching user details for user_id: ${user_id}, date: ${date || 'all'}, trip_id: ${trip_id || 'all'}`);

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
      query.timestamp = { $gte: startOfDay, $lt: endOfDay };
    }
    if (trip_id) {
      query.trip_id = trip_id;
    }

    const [locations, event_logs, trip_count] = await Promise.all([
      Location.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$trip_id',
            user_id: { $first: '$user_id' },
            start_location: { $first: '$start_location' },
            end_location: { $first: '$end_location' },
            traveled_path: { $first: '$traveled_path' },
            start_time: { $first: '$start_time' },
            stop_time: { $last: '$stop_time' },
            timestamp: { $first: '$timestamp' },
            total_distance: { $first: '$total_distance' },
            total_drive_time: {
              $max: {
                $cond: [
                  { $and: [{ $ne: ['$start_time', null] }, { $ne: ['$stop_time', null] }] },
                  { $subtract: ['$stop_time', '$start_time'] },
                  null
                ]
              }
            }
          }
        },
        { $sort: { timestamp: -1 } }
      ]),
      Event.find(query).lean(),
      // Count distinct trips for the date
      date ? Location.distinct('trip_id', { user_id, timestamp: { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) } }).then(trips => trips.length) : Promise.resolve(0)
    ]);

    // Format locations with total_drive_time in seconds
    const formattedLocations = locations.map(loc => ({
      trip_id: loc._id,
      user_id: loc.user_id,
      start_location: loc.start_location,
      end_location: loc.end_location,
      traveled_path: loc.traveled_path,
      start_time: loc.start_time,
      stop_time: loc.stop_time,
      timestamp: loc.timestamp,
      total_distance: loc.total_distance,
      total_drive_time: loc.total_drive_time ? Math.floor(loc.total_drive_time / 1000) : null
    }));

    logger.info(`[${new Date().toISOString()}] Fetched ${formattedLocations.length} trips, ${event_logs.length} events, and ${trip_count} distinct trips for user_id: ${user_id}, date: ${date || 'all'}, trip_id: ${trip_id || 'all'}`);
    res.json({
      success: true,
      user: {
        ...user.toObject(),
        id: user._id,
        locations: formattedLocations,
        event_logs,
        trip_count // Include the number of distinct trips for the date
      }
    });
  } catch (error) {
    logger.error(`[${new Date().toISOString()}] Error fetching user details: ${error.message}`);
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