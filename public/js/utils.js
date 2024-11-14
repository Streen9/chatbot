// Utility functions
const utils = {
  // Debounce function to limit how often a function can be called
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function to ensure function is called at most once per specified period
  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  // Validate file type
  isValidFileType(filename, allowedTypes) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return allowedTypes.includes(ext);
  },

  // Sanitize text for display
  sanitizeText(text) {
    return DOMPurify.sanitize(text);
  },

  // Parse markdown safely
  parseMarkdown(text) {
    return this.sanitizeText(marked.parse(text));
  },

  // Handle fetch errors
  async handleFetchResponse(response) {
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.message || "Server error");
      }
      throw new Error("Network response was not ok");
    }

    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }

    throw new Error("Invalid response type");
  },

  // Log error with context
  logError(error, context = "") {
    console.error(`Error${context ? ` in ${context}` : ""}:`, error);
  },
};
