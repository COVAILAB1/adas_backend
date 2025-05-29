const mongoose = require('mongoose');

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
    password: { type: String, required: true },
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

// Models
const User = mongoose.model('User', userSchema);
const CarDetails = mongoose.model('CarDetails', carDetailsSchema);
const DriverScore = mongoose.model('DriverScore', driverScoreSchema);
const EventLog = mongoose.model('EventLog', eventLogSchema);

// Function to create collections and optionally insert sample data
async function createCollections() {
    try {
        // Ensure collections are registered by creating a sample document
        // You can remove this if you only want to create empty collections
        const sampleUser = await User.create({
            username: 'testuser',
            password: 'testpass', // In production, hash this
            role: 'user',
            full_name: 'Test User',
            email: 'test@example.com'
        });

        await CarDetails.create({
            user_id: sampleUser._id,
            car_name: 'Toyota Camry',
            car_number: 'ABC123',
            obd_name: 'OBD-II Device',
            bluetooth_mac: '00:1A:7D:DA:71:13'
        });

        await DriverScore.create({
            user_id: sampleUser._id,
            score: 100
        });

        await EventLog.create({
            user_id: sampleUser._id,
            event_type: 'speeding',
            event_description: 'Exceeded speed limit by 10 mph'
        });

        console.log('Collections created and sample data inserted successfully');
    } catch (error) {
        console.error('Error creating collections:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run the function
createCollections();