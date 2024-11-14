const { generateAIResponse } = require("../services/ai.service");
const { findRelevantChunks } = require("../services/document.service");
const logger = require("../utils/logger");

const handleChatMessage = async (ws, message, clientId) => {
  try {
    const relevantChunks = await findRelevantChunks(message);

    if (!relevantChunks || relevantChunks.length === 0) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No relevant content found",
        })
      );
      return;
    }

    ws.send(
      JSON.stringify({
        type: "progress",
        message: "Found relevant content chunks",
        chunksFound: relevantChunks.length,
      })
    );

    const responseStream = await generateAIResponse(message, relevantChunks);

    for await (const chunk of responseStream) {
      if (ws.readyState === 1) {
        // Check if connection is still open
        ws.send(
          JSON.stringify({
            type: "response",
            message: chunk,
            isComplete: false,
          })
        );
      } else {
        break;
      }
    }

    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "response",
          message: "",
          isComplete: true,
        })
      );
    }
  } catch (error) {
    logger.error("Chat processing error", {
      error: error.message,
      clientId,
    });

    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Error generating response",
        })
      );
    }
  }
};

module.exports = {
  handleChatMessage,
};
