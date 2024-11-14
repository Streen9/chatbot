const logger = require("../utils/logger");
const { handleChatMessage } = require("../controllers/chat.controller");

const clients = new Map();

const handleWebSocketConnection = (ws) => {
  const clientId = Date.now();
  clients.set(clientId, ws);

  logger.info("New WebSocket connection established", { clientId });

  // Set up ping-pong for connection health monitoring
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Send initial connection confirmation
  ws.send(
    JSON.stringify({
      type: "connection",
      message: "Connected successfully",
      clientId,
    })
  );

  // Handle incoming messages
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      logger.debug("Received WebSocket message", {
        clientId,
        type: data.type,
      });

      switch (data.type) {
        case "chat":
          await handleChatMessage(ws, data.message, clientId);
          break;
        default:
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
            })
          );
      }
    } catch (error) {
      logger.error("WebSocket message handling error", {
        error: error.message,
        clientId,
      });
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error processing message",
        })
      );
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    clients.delete(clientId);
    logger.info("Client disconnected", { clientId });
  });

  // Handle errors
  ws.on("error", (error) => {
    logger.error("WebSocket error", {
      error: error.message,
      clientId,
    });
  });
};

const broadcastToClients = (message) => {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      // If client is connected
      client.send(JSON.stringify(message));
    }
  });
};

module.exports = {
  handleWebSocketConnection,
  broadcastToClients,
};
