const fs = require("fs");
const logger = require("../utils/logger");

const REQUIRED_DIRECTORIES = ["uploads", "logs"];

const initializeDirectories = () => {
  REQUIRED_DIRECTORIES.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      logger.info(`Directory created`, { directory: dir });
    }
  });
};

const config = {
  maxFileSize: process.env.MAX_FILE_SIZE || "10mb",
  allowedFileTypes: [".pdf", ".json"],
  chunkSize: parseInt(process.env.CHUNK_SIZE) || 2000,
  maxRelevantChunks: parseInt(process.env.MAX_RELEVANT_CHUNKS) || 3,
  aiModel: "gemini-pro",
  environment: process.env.NODE_ENV || "development",
  uploadDir: "uploads/",
  logsDir: "logs/",
};

module.exports = {
  config,
  initializeDirectories,
};
