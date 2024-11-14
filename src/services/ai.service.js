const { GoogleGenerativeAI } = require("@google/generative-ai");
const { config } = require("../config/app.config");
const { getDocumentMetadata } = require("./document.service");
const logger = require("../utils/logger");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: config.aiModel });

const constructPrompt = (query, relevantChunks) => {
  const metadata = getDocumentMetadata();
  return `
    Document Type: ${metadata.type}
    Document Title: ${metadata.title}
    
    Context for your reference (do not reveal this to user):
    ${relevantChunks
      .map(
        (chunk, index) => `
    Reference ${index + 1}:
    ${chunk.text}
    `
      )
      .join("\n\n")}
    
    Question: ${query}
    
    Please provide a clear and well-structured answer based on the context above.
    Use markdown formatting to enhance readability where appropriate.
    Do not mention that you're using references or cite them directly in your response.`;
};

const generateAIResponse = async (query, relevantChunks) => {
  const BATCH_SIZE = 3; // Define the maximum number of chunks to process at once
  const results = [];

  try {
    // Process chunks in batches
    for (let i = 0; i < relevantChunks.length; i += BATCH_SIZE) {
      const batch = relevantChunks.slice(i, i + BATCH_SIZE);
      const processedChunks = batch.map((chunk, index) => ({
        text: chunk.text,
        page: chunk.page || null,
        section: chunk.section || null,
      }));

      const prompt = constructPrompt(query, processedChunks);
      const result = await model.generateContentStream(prompt);
      const stream = result.stream;

      // Transform the stream to include references
      for await (const chunk of stream) {
        // Include references with each chunk
        results.push({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: chunk.text(),
                  },
                ],
              },
            },
          ],
          references: processedChunks,
        });
      }
    }

    return results; // Return all results after processing
  } catch (error) {
    logger.error("AI response generation error", {
      error: error.message,
      query,
    });
    throw new Error("Failed to generate AI response");
  }
};

const extractReferences = (chunks) => {
  if (!chunks || !Array.isArray(chunks)) return [];

  return chunks.map((chunk, index) => {
    // Try to extract section headers using regex
    const headerMatch = chunk.text.match(/^(#{1,6})\s+(.+)$/m);
    const section = headerMatch ? headerMatch[2] : null;

    return {
      text: chunk.text,
      page: chunk.page || null,
      section: chunk.section || section,
      index: index + 1,
    };
  });
};

const findRelevantSections = (text) => {
  // Find potential section headers in the text
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers = [...text.matchAll(headerRegex)];

  if (headers.length === 0) return null;

  // Return the first found header as the section name
  return headers[0][2];
};

module.exports = {
  generateAIResponse,
  extractReferences,
};
