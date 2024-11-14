const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const { config } = require("../config/app.config");
const logger = require("../utils/logger");

let documentChunks = [];
let documentMetadata = {
  title: "",
  type: "",
  totalChunks: 0,
};

const extractSectionFromPDFText = (text) => {
  // Look for common header patterns
  const headerRegex =
    /(?:^|\n)(?:#{1,6}|chapter\s+\d+|\d+\.\d+\s+|\w+\s*\d+[:.])\s*([^\n]+)/i;
  const match = text.match(headerRegex);
  return match ? match[1].trim() : null;
};

const splitIntoChunks = (text, pageNumber = null) => {
  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/); // Split by double newline
  let currentChunk = "";
  let currentSection = null;

  for (const paragraph of paragraphs) {
    // Check if this paragraph is a new section header
    const possibleHeader = extractSectionFromPDFText(paragraph);
    if (possibleHeader) {
      currentSection = possibleHeader;
    }

    if ((currentChunk + paragraph).length > config.chunkSize) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          page: pageNumber,
          section: currentSection,
        });
        currentChunk = "";
      }
    }
    currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      page: pageNumber,
      section: currentSection,
    });
  }

  return chunks;
};

const processPDFData = async (dataBuffer) => {
  const data = await pdf(dataBuffer);
  let allChunks = [];

  // Process each page separately to maintain page numbers
  for (let i = 0; i < data.numpages; i++) {
    const pageNum = i + 1;
    // Note: This is a simplified version. You'll need to implement proper
    // page text extraction based on your PDF library's capabilities
    const pageText = data.text; // You'll need to modify this based on your PDF library
    const pageChunks = splitIntoChunks(pageText, pageNum);
    allChunks = allChunks.concat(pageChunks);
  }

  return allChunks;
};

const processJSONData = (obj, parent = "") => {
  const chunks = [];
  let currentChunk = "";
  let currentSection = parent;

  const processNode = (node, nodePath) => {
    for (const [key, value] of Object.entries(node)) {
      const currentPath = nodePath ? `${nodePath}.${key}` : key;

      if (typeof value === "object" && value !== null) {
        currentSection = key;
        processNode(value, currentPath);
      } else {
        const text = `${currentPath}: ${value}\n`;

        if ((currentChunk + text).length > config.chunkSize) {
          if (currentChunk) {
            chunks.push({
              text: currentChunk.trim(),
              section: currentSection,
            });
            currentChunk = "";
          }
        }
        currentChunk += text;
      }
    }
  };

  processNode(obj, "");

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      section: currentSection,
    });
  }

  return chunks;
};

const processDocument = async (file) => {
  try {
    const filePath = file.path;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let chunks = [];

    if (fileExtension === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      chunks = await processPDFData(dataBuffer);
      documentMetadata = {
        title: file.originalname,
        type: "PDF",
        pages: chunks.length,
      };
    } else if (fileExtension === ".json") {
      const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      chunks = processJSONData(jsonData);
      documentMetadata = {
        title: file.originalname,
        type: "JSON",
        structure: Object.keys(jsonData),
      };
    }

    documentChunks = chunks;
    documentMetadata.totalChunks = chunks.length;

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return {
      metadata: documentMetadata,
      success: true,
    };
  } catch (error) {
    logger.error("Document processing error", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Document processing failed");
  }
};

const calculateRelevance = (query, chunk) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  let relevanceScore = 0;

  // Give extra weight to section headers
  if (chunk.section) {
    const sectionWords = chunk.section.toLowerCase().split(/\s+/);
    const sectionMatches = queryWords.filter((word) =>
      sectionWords.some((sectionWord) => sectionWord.includes(word))
    );
    relevanceScore += sectionMatches.length * 2;
  }

  // Score the main content
  const chunkWords = chunk.text.toLowerCase().split(/\s+/);
  for (const queryWord of queryWords) {
    const matches = chunkWords.filter((word) => word.includes(queryWord));
    relevanceScore += matches.length;

    // Extra points for exact matches
    const exactMatches = matches.filter((word) => word === queryWord);
    relevanceScore += exactMatches.length;
  }

  return relevanceScore;
};

const findRelevantChunks = async (query) => {
  if (documentChunks.length === 0) {
    throw new Error("No document loaded");
  }

  // Sort chunks by relevance
  const rankedChunks = documentChunks
    .map((chunk) => ({
      ...chunk,
      relevance: calculateRelevance(query, chunk),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, config.maxRelevantChunks);

  return rankedChunks;
};

const getDocumentMetadata = () => documentMetadata;

module.exports = {
  processDocument,
  findRelevantChunks,
  getDocumentMetadata,
};
