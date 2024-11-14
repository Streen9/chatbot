const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');
const { handleWebSocketConnection } = require('../services/websocket.service');

let wss;

const initializeWebSocket = (server) => {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', handleWebSocketConnection);

    // Heartbeat implementation
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                logger.info('Terminating inactive WebSocket connection');
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    return wss;
};

const getWebSocketServer = () => wss;

module.exports = {
    initializeWebSocket,
    getWebSocketServer
};