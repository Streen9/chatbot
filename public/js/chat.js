class ChatManager {
  constructor() {
    this.chatForm = document.getElementById("chatForm");
    this.messageInput = document.getElementById("messageInput");
    this.chatMessages = document.getElementById("chatMessages");
    this.currentResponseDiv = null;
    this.currentContent = "";
    this.activePopup = null;

    this.initializeMarkdown();
    this.chatForm.addEventListener("submit", this.handleSubmit.bind(this));
    document.addEventListener("click", this.handleGlobalClick.bind(this));
  }

  initializeMarkdown() {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false,
      sanitize: false,
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error("Highlight error:", err);
          }
        }
        return code;
      },
      langPrefix: "hljs language-",
      renderer: this.createCustomRenderer(),
    });
  }

  createCustomRenderer() {
    const renderer = new marked.Renderer();

    renderer.heading = (text, level) => {
      const escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");
      return `
                <h${level} id="${escapedText}" class="group cursor-pointer">
                    <span class="mr-2">${text}</span>
                    <a href="#${escapedText}" class="opacity-0 group-hover:opacity-100 text-blue-500">¶</a>
                </h${level}>
            `;
    };

    renderer.code = (code, language) => {
      const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
      const highlightedCode = hljs.highlight(code, {
        language: validLanguage,
      }).value;
      return `
                <div class="code-block relative group">
                    <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="navigator.clipboard.writeText(this.parentElement.parentElement.querySelector('code').textContent)" 
                                class="copy-btn bg-gray-700 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 transition-colors">
                            Copy
                        </button>
                    </div>
                    <div class="bg-gray-800 rounded-t-md px-4 py-2 text-xs text-gray-400 flex justify-between items-center">
                        <span>${validLanguage}</span>
                    </div>
                    <pre class="!mt-0 !bg-gray-800"><code class="hljs language-${validLanguage}">${highlightedCode}</code></pre>
                </div>
            `;
    };

    renderer.blockquote = (quote) => {
      return `
                <blockquote class="border-l-4 border-blue-500 pl-4 italic bg-gray-50 py-2 px-3 rounded my-4">
                    ${quote}
                </blockquote>
            `;
    };

    renderer.list = (body, ordered, start) => {
      const type = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
      const className = ordered ? "list-decimal" : "list-disc";
      return `<${type}${startAttr} class="pl-5 ${className} space-y-2 my-4">${body}</${type}>`;
    };

    renderer.listitem = (text) => {
      return `<li class="pl-2">${text}</li>`;
    };

    renderer.table = (header, body) => {
      return `
                <div class="overflow-x-auto my-4">
                    <table class="min-w-full divide-y divide-gray-200 border">
                        <thead class="bg-gray-50">
                            ${header}
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${body}
                        </tbody>
                    </table>
                </div>
            `;
    };

    renderer.tablerow = (content) => {
      return `<tr class="hover:bg-gray-50 transition-colors">${content}</tr>`;
    };

    renderer.tablecell = (content, { header }) => {
      if (header) {
        return `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${content}</th>`;
      }
      return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${content}</td>`;
    };

    renderer.codespan = (code) => {
      return `<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">${code}</code>`;
    };

    renderer.link = (href, title, text) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `
                <a href="${href}"${titleAttr} 
                   class="text-blue-600 hover:text-blue-800 underline" 
                   target="_blank" rel="noopener noreferrer">
                    ${text}
                </a>
            `;
    };

    renderer.image = (href, title, text) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `
                <img src="${href}" alt="${text}"${titleAttr} 
                     class="max-w-full h-auto rounded-lg shadow-lg my-4" 
                     loading="lazy">
            `;
    };

    return renderer;
  }

  handleSubmit(e) {
    e.preventDefault();
    const message = this.messageInput.value.trim();

    if (!message) return;

    this.addMessage("user", message);
    this.messageInput.value = "";
    this.currentContent = "";

    wsService.sendMessage({
      type: "chat",
      message: message,
    });
  }

  handleGlobalClick(e) {
    if (
      this.activePopup &&
      !this.activePopup.contains(e.target) &&
      !e.target.closest(".reference-link")
    ) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  handleResponse(data) {
    try {
      // Handle completion message
      if (data.isComplete) {
        if (this.currentResponseDiv && this.currentContent) {
          const contentDiv =
            this.currentResponseDiv.querySelector(".message-content");
          contentDiv.innerHTML = this.renderMarkdown(this.currentContent);
          this.initializeCodeCopyButtons(contentDiv);
        }
        this.currentResponseDiv = null;
        this.currentContent = "";
        return;
      }

      // Initialize message content
      let messageText = "";
      let references = [];

      // Handle error responses
      if (data.type === "error") {
        this.handleError(data);
        return;
      }

      // Extract message text and references
      if (data.message?.candidates?.[0]?.content?.parts?.[0]?.text) {
        messageText = data.message.candidates[0].content.parts[0].text;

        // Handle references if present
        if (data.message.references) {
          references = this.deduplicateReferences(data.message.references);
        }
      } else if (typeof data.message === "string") {
        messageText = data.message;
      } else {
        console.error("Unexpected message format:", data);
        this.handleError({ message: "Invalid message format received" });
        return;
      }

      // Remove [object Object] artifacts if present
      messageText = messageText.replace(/\[object Object\]/g, "");

      // Update current content
      this.currentContent += messageText;

      // Create or update message element
      if (!this.currentResponseDiv) {
        this.currentResponseDiv = this.createMessageElement("ai");
        this.chatMessages.appendChild(this.currentResponseDiv);
      }

      const contentDiv =
        this.currentResponseDiv.querySelector(".message-content");

      // Safely render the markdown content
      try {
        contentDiv.innerHTML = this.renderMarkdown(this.currentContent);
        this.initializeCodeCopyButtons(contentDiv);
      } catch (renderError) {
        console.error("Error rendering markdown:", renderError);
        contentDiv.textContent = this.currentContent; // Fallback to plain text
      }

      // Update references if present
      if (references.length > 0) {
        this.updateReferenceLinks(this.currentResponseDiv, references);
      }

      this.scrollToBottom();
    } catch (error) {
      console.error("Error processing response:", error);
      this.handleError({
        message: "Error processing response: " + error.message,
      });
    }
  }

  handleError(data) {
    const errorDiv = this.createMessageElement("error");
    const contentDiv = errorDiv.querySelector(".message-content");

    // Enhanced error message handling
    let errorMessage = "An error occurred";
    if (data.message) {
      errorMessage =
        typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.message);
    }

    contentDiv.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${this.escapeHtml(errorMessage)}</span>
      </div>
    `;

    this.chatMessages.appendChild(errorDiv);
    this.currentResponseDiv = null;
    this.currentContent = "";
    this.scrollToBottom();
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  createMessageElement(type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message p-4 rounded-lg my-2 ${
      type === "user"
        ? "bg-blue-100 ml-12"
        : type === "error"
        ? "bg-red-100 text-red-700"
        : type === "system"
        ? "bg-green-100 text-green-800"
        : "bg-gray-100 mr-12"
    }`;

    const headerText =
      type === "user"
        ? "You"
        : type === "error"
        ? "Error"
        : type === "system"
        ? "System"
        : "AI";

    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    messageDiv.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold text-sm flex items-center gap-2">
            <span>${headerText}</span>
            <span class="text-xs text-gray-500">${timestamp}</span>
          </div>
          ${
            type === "error"
              ? `
            <button class="text-red-500 hover:text-red-700 text-sm" 
                    onclick="this.closest('.message').remove()">
              Dismiss
            </button>
          `
              : ""
          }
        </div>
        <div class="message-content prose prose-sm max-w-none"></div>
        ${
          type === "ai"
            ? '<div class="references-section mt-4 hidden"></div>'
            : ""
        }
      `;

    return messageDiv;
  }
  deduplicateReferences(references) {
    const uniqueRefs = new Map();
    references.forEach((ref) => {
      const key = `${ref.page}`;
      if (!uniqueRefs.has(key)) {
        uniqueRefs.set(key, ref);
      }
    });
    return Array.from(uniqueRefs.values());
  }

  updateReferenceLinks(messageDiv, references) {
    let refsDiv = messageDiv.querySelector(".reference-links");
    if (!refsDiv) {
      refsDiv = document.createElement("div");
      refsDiv.className = "reference-links mt-4 pt-3 border-t border-gray-200";
      messageDiv.appendChild(refsDiv);
    }

    refsDiv.innerHTML = `
            <div class="text-sm text-gray-600 mb-2">References:</div>
            <div class="flex flex-wrap gap-2">
                ${references
                  .map(
                    (ref) => `
                    <button class="reference-link px-2 py-1 bg-gray-100 hover:bg-gray-200 
                                 rounded-md text-sm transition-colors"
                            data-page="${ref.page}"
                            data-text="${this.escapeHtml(ref.text)}">
                        Page ${ref.page}
                    </button>
                `
                  )
                  .join("")}
            </div>
        `;

    refsDiv.querySelectorAll(".reference-link").forEach((link) => {
      link.addEventListener("click", (e) => this.showReferencePopup(e.target));
    });
  }

  showReferencePopup(linkElement) {
    if (this.activePopup) {
      this.activePopup.remove();
    }

    const rect = linkElement.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className =
      "fixed bg-white rounded-lg shadow-xl border p-4 max-w-lg max-h-96 " +
      "overflow-y-auto z-50 reference-popup";

    popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    const page = linkElement.dataset.page;
    const text = linkElement.dataset.text;

    popup.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div class="text-sm font-medium text-gray-600">Page ${page}</div>
                <button class="text-gray-400 hover:text-gray-600 transition-colors" 
                        onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="prose prose-sm">
                ${this.renderMarkdown(text)}
            </div>
        `;

    document.body.appendChild(popup);
    this.activePopup = popup;

    // Adjust popup position if it goes off screen
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
    }
    if (popupRect.bottom > window.innerHeight) {
      popup.style.top = `${rect.top + window.scrollY - popupRect.height - 5}px`;
    }
    if (popupRect.top < 0) {
      popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }
  }

  renderMarkdown(content) {
    return DOMPurify.sanitize(marked.parse(content), {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
    });
  }

  initializeCodeCopyButtons(container) {
    container.querySelectorAll(".copy-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const code = button
          .closest(".code-block")
          .querySelector("code").textContent;
        navigator.clipboard.writeText(code).then(() => {
          const originalText = button.textContent;
          button.textContent = "Copied!";
          button.classList.add("bg-green-600");
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("bg-green-600");
          }, 2000);
        });
      });
    });
  }

  addMessage(type, content) {
    const messageDiv = this.createMessageElement(type);
    const contentDiv = messageDiv.querySelector(".message-content");

    if (type === "user") {
      contentDiv.textContent = content;
    } else {
      contentDiv.innerHTML = this.renderMarkdown(content);
      if (type === "ai") {
        this.initializeCodeCopyButtons(contentDiv);
      }
    }

    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  scrollToBottom() {
    // Smooth scroll to bottom with a small delay to ensure content is rendered
    setTimeout(() => {
      this.chatMessages.scrollTo({
        top: this.chatMessages.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }

  updateTypingIndicator(show) {
    const typingDiv = document.getElementById("typingIndicator");
    if (!typingDiv) return;

    if (show) {
      typingDiv.classList.remove("hidden");
      typingDiv.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="typing-dot animate-bounce"></div>
                    <div class="typing-dot animate-bounce" style="animation-delay: 0.2s"></div>
                    <div class="typing-dot animate-bounce" style="animation-delay: 0.4s"></div>
                </div>
            `;
    } else {
      typingDiv.classList.add("hidden");
    }
  }

  handleKeydown(e) {
    // Handle Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      this.handleSubmit(e);
    }
  }

  clear() {
    // Clear chat history
    this.chatMessages.innerHTML = "";
    this.currentContent = "";
    this.currentResponseDiv = null;
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  isTyping() {
    return this.currentResponseDiv !== null;
  }

  getLastMessage() {
    const messages = this.chatMessages.querySelectorAll(".message-content");
    return messages[messages.length - 1]?.textContent || null;
  }

  addSystemMessage(message) {
    this.addMessage("system", message);
  }

  updateLastMessage(content) {
    if (this.currentResponseDiv) {
      const contentDiv =
        this.currentResponseDiv.querySelector(".message-content");
      if (contentDiv) {
        contentDiv.innerHTML = this.renderMarkdown(content);
        this.initializeCodeCopyButtons(contentDiv);
        this.scrollToBottom();
      }
    }
  }

  focusInput() {
    this.messageInput.focus();
  }

  disableInput() {
    this.messageInput.disabled = true;
    this.messageInput.placeholder = "Please wait...";
  }

  enableInput() {
    this.messageInput.disabled = false;
    this.messageInput.placeholder = "Ask a question about the document...";
    this.focusInput();
  }

  formatTimestamp(date) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  destroy() {
    // Cleanup event listeners
    this.chatForm.removeEventListener("submit", this.handleSubmit);
    document.removeEventListener("click", this.handleGlobalClick);
    window.removeEventListener("keydown", this.handleKeydown);
  }
}

// Initialize the chat manager
const chatManager = new ChatManager();
