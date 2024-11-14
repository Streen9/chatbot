const express = require('express');
const http = require('http');
const { initializeWebSocket } = require('./config/websocket.config');
const { errorHandler } = require('./middleware/error.middleware');
const uploadRoutes = require('./controllers/upload.controller');
const logger = require('./utils/logger');
const { initializeDirectories } = require('./config/app.config');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket
initializeWebSocket(server);

// Initialize required directories
initializeDirectories();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/upload', uploadRoutes);

// Error handling
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
        reason: reason,
        promise: promise
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
});

module.exports = app;