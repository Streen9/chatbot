const multer = require("multer");
const path = require("path");
const { config } = require("../config/app.config");
const logger = require("../utils/logger");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    logger.debug("Setting upload destination", {
      destination: config.uploadDir,
    });
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${path.basename(file.originalname)}`;
    logger.debug("Generating upload filename", {
      originalName: file.originalname,
      generatedName: filename,
    });
    cb(null, filename);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.allowedFileTypes.includes(ext)) {
    logger.debug("File type accepted", {
      fileType: ext,
      filename: file.originalname,
    });
    cb(null, true);
  } else {
    logger.warn("Invalid file type attempted", {
      fileType: ext,
      filename: file.originalname,
    });
    cb(new Error("Invalid file type"));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

// Middleware wrapper to handle errors
const uploadMiddleware = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error("Multer error during upload", { error: err });
      return res.status(400).json({
        error: "File upload error",
        details: err.message,
      });
    } else if (err) {
      logger.error("Error during upload", { error: err });
      return res.status(400).json({
        error: "Invalid file",
        details: err.message,
      });
    }
    next();
  });
};

module.exports = {
  uploadMiddleware,
};
