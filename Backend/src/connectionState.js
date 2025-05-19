const mongoose = require('mongoose');

const connectionState = {
    isConnected: false,
    connect: async (uri) => {
        try {
            await mongoose.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            connectionState.isConnected = true;
            console.log('Database connected successfully');
        } catch (error) {
            connectionState.isConnected = false;
            console.error('Database connection error:', error);
        }
    },
    disconnect: async () => {
        try {
            await mongoose.disconnect();
            connectionState.isConnected = false;
            console.log('Database disconnected successfully');
        } catch (error) {
            console.error('Database disconnection error:', error);
        }
    }
};

module.exports = connectionState;