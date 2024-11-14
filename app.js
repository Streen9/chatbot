// app.js
const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { WebSocketServer } = require('ws');
const http = require('http');
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configure Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        logger.debug("Setting upload destination", { destination: "uploads/" });
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const filename = Date.now() + path.extname(file.originalname);
        logger.debug("Generating upload filename", { 
            originalName: file.originalname,
            generatedName: filename 
        });
        cb(null, filename);
    },
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.json'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            logger.debug("File type accepted", { 
                fileType: ext, 
                filename: file.originalname 
            });
            cb(null, true);
        } else {
            logger.warn("Invalid file type attempted", { 
                fileType: ext,
                filename: file.originalname
            });
            cb(new Error('Invalid file type'));
        }
    }
});

// Create necessary directories
['uploads', 'logs'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        logger.info(`Directory created`, { directory: dir });
    }
});

// Store document chunks and metadata
let documentChunks = [];
let documentMetadata = {
    title: "",
    type: "",
    totalChunks: 0,
};

// Store connected clients
const clients = new Map();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// WebSocket connection handler
wss.on('connection', (ws) => {
    const clientId = Date.now();
    clients.set(clientId, ws);
    
    logger.info('New WebSocket connection established', { clientId });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected successfully',
        clientId
    }));

    // Handle incoming messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            logger.debug('Received WebSocket message', { clientId, type: data.type });

            switch (data.type) {
                case 'chat':
                    handleChatMessage(ws, data.message, clientId);
                    break;
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            logger.error('WebSocket message handling error', {
                error: error.message,
                clientId
            });
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Error processing message'
            }));
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        clients.delete(clientId);
        logger.info('Client disconnected', { clientId });
    });
});

// Helper function to split text into chunks
function splitIntoChunks(text, chunkSize = 2000) {
    const chunks = [];
    const sentences = text.split(/[.!?]+\s/);
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

// Calculate relevance between query and chunk
function calculateRelevance(query, chunk) {
    const queryWords = query.toLowerCase().split(" ");
    const chunkWords = chunk.toLowerCase().split(" ");
    let relevanceScore = 0;

    for (const queryWord of queryWords) {
        if (queryWord.length <= 2) continue; // Skip very short words
        
        // Direct matches
        const exactMatches = chunkWords.filter(word => word === queryWord);
        relevanceScore += exactMatches.length * 2;

        // Partial matches for longer words
        if (queryWord.length > 4) {
            const partialMatches = chunkWords.filter(word => 
                word.length > 4 && (word.includes(queryWord) || queryWord.includes(word))
            );
            relevanceScore += partialMatches.length;
        }
    }

    return relevanceScore;
}

// Find relevant chunks for a query
function findRelevantChunks(query, chunks, numChunks = 3) {
    return chunks
        .map((chunk, index) => ({
            index,
            chunk,
            relevance: calculateRelevance(query, chunk)
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, numChunks)
        .map(item => item.chunk);
}

// Process JSON data recursively
function processJSONData(obj, parent = "") {
    let textContent = "";
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = parent ? `${parent}.${key}` : key;
        if (typeof value === "object" && value !== null) {
            textContent += `${currentPath}:\n${processJSONData(value, currentPath)}\n`;
        } else {
            textContent += `${currentPath}: ${value}\n`;
        }
    }
    return textContent;
}

// Handle chat messages through WebSocket
async function handleChatMessage(ws, message, clientId) {
    try {
        if (documentChunks.length === 0) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No document uploaded'
            }));
            return;
        }

        // Find relevant chunks
        const relevantChunks = findRelevantChunks(message, documentChunks);
        
        // Send progress update
        ws.send(JSON.stringify({
            type: 'progress',
            message: 'Found relevant content chunks',
            chunksFound: relevantChunks.length
        }));

        // Construct prompt
        const prompt = `
        Document Type: ${documentMetadata.type}
        Document Title: ${documentMetadata.title}
        
        Relevant Context:
        ${relevantChunks.join("\n\n")}
        
        Question: ${message}
        
        Please provide a clear and well-structured answer based on the context above.
        Use markdown formatting to enhance readability where appropriate.`;

        // Generate response using Gemini with streaming
        const result = await model.generateContentStream(prompt);

        // Stream the response chunks
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                ws.send(JSON.stringify({
                    type: 'response',
                    message: chunkText,
                    isComplete: false
                }));
            }
        }

        // Send completion message
        ws.send(JSON.stringify({
            type: 'response',
            message: '',
            isComplete: true
        }));

    } catch (error) {
        logger.error('Chat processing error', {
            error: error.message,
            clientId
        });
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Error generating response'
        }));
    }
}

// File upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn("Upload attempted without file");
            return res.status(400).json({ 
                error: "No file uploaded" 
            });
        }

        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        let textContent = "";

        if (fileExtension === ".pdf") {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdf(dataBuffer);
            textContent = pdfData.text;
            documentMetadata = {
                title: req.file.originalname,
                type: "PDF",
                pages: pdfData.numpages
            };
        } else if (fileExtension === ".json") {
            const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
            textContent = processJSONData(jsonData);
            documentMetadata = {
                title: req.file.originalname,
                type: "JSON",
                structure: Object.keys(jsonData)
            };
        }

        documentChunks = splitIntoChunks(textContent);
        documentMetadata.totalChunks = documentChunks.length;

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Broadcast document update to all connected clients
        const updateMessage = JSON.stringify({
            type: 'documentUpdate',
            metadata: documentMetadata
        });
        
        clients.forEach(client => {
            if (client.readyState === 1) { // If client is connected
                client.send(updateMessage);
            }
        });

        res.json({
            message: "File processed successfully",
            metadata: {
                ...documentMetadata,
                approximateWords: textContent.split(/\s+/).length
            }
        });

    } catch (error) {
        logger.error("File processing error", {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            error: "File processing failed"
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info("Server started", {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

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

module.exports = app;