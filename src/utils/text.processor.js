const { config } = require("../config/app.config");

const splitIntoChunks = (text, chunkSize = config.chunkSize) => {
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
};

const calculateRelevance = (query, chunk) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const chunkWords = chunk.toLowerCase().split(/\s+/);
  let relevanceScore = 0;

  // TF-IDF inspired scoring
  for (const queryWord of queryWords) {
    // Direct matches
    const exactMatches = chunkWords.filter((word) => word === queryWord);
    relevanceScore += exactMatches.length * 2;

    // Partial matches for longer words
    if (queryWord.length > 4) {
      const partialMatches = chunkWords.filter(
        (word) =>
          word.length > 4 &&
          (word.includes(queryWord) ||
            queryWord.includes(word) ||
            levenshteinDistance(word, queryWord) <= 2)
      );
      relevanceScore += partialMatches.length;
    }
  }

  // Boost score for chunks containing multiple query terms close together
  const proximityBoost = calculateProximityBoost(queryWords, chunkWords);
  relevanceScore += proximityBoost;

  return relevanceScore;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = Array(str2.length + 1)
    .fill()
    .map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1, // deletion
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
};

const calculateProximityBoost = (queryWords, chunkWords) => {
  let boost = 0;
  const window = 6; // Words to check for proximity

  for (let i = 0; i < chunkWords.length - window; i++) {
    const windowWords = chunkWords.slice(i, i + window);
    const matchedTerms = queryWords.filter((term) =>
      windowWords.some((word) => word.includes(term))
    );
    if (matchedTerms.length > 1) {
      boost += matchedTerms.length;
    }
  }

  return boost;
};

module.exports = {
  splitIntoChunks,
  calculateRelevance,
};
