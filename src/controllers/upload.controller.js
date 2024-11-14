const express = require('express');
const router = express.Router();
const { uploadMiddleware } = require('../middleware/upload.middleware');
const { processDocument } = require('../services/document.service');
const { getWebSocketServer } = require('../config/websocket.config');
const logger = require('../utils/logger');

router.post('/', uploadMiddleware, async (req, res, next) => {
    try {
        if (!req.file) {
            logger.warn('Upload attempted without file');
            return res.status(400).json({ 
                error: 'No file uploaded' 
            });
        }

        const result = await processDocument(req.file);

        // Broadcast document update to all connected clients
        const wss = getWebSocketServer();
        const updateMessage = JSON.stringify({
            type: 'documentUpdate',
            metadata: result.metadata
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(updateMessage);
            }
        });

        res.json({
            message: 'File processed successfully',
            metadata: result.metadata
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;