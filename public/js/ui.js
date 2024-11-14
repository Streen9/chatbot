// Initialize UI components and global handlers
document.addEventListener("DOMContentLoaded", () => {
  // Initialize WebSocket connection
  wsClient.connect();

  // Setup global error handling
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    chatManager.addMessage(
      "error",
      "An unexpected error occurred. Please try again."
    );
  });

  // Setup unload warning
  window.addEventListener("beforeunload", (event) => {
    if (uploadManager.isUploading || chatManager.isTyping) {
      event.preventDefault();
      return (event.returnValue =
        "You have an ongoing operation. Are you sure you want to leave?");
    }
  });

  // Handle keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    // Ctrl/Cmd + Enter to send message
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      const messageInput = document.getElementById("messageInput");
      if (document.activeElement === messageInput) {
        chatManager.chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  // Initialize tooltips and other UI enhancements
  initializeTooltips();
  setupAccessibility();
});

function initializeTooltips() {
  const tooltips = document.querySelectorAll("[data-tooltip]");
  tooltips.forEach((element) => {
    element.addEventListener("mouseenter", showTooltip);
    element.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(event) {
  const tooltip = document.createElement("div");
  tooltip.className =
    "tooltip absolute bg-gray-900 text-white px-2 py-1 rounded text-sm";
  tooltip.textContent = event.target.dataset.tooltip;
  document.body.appendChild(tooltip);

  const rect = event.target.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + 5}px`;
  tooltip.style.left = `${
    rect.left + (rect.width - tooltip.offsetWidth) / 2
  }px`;
}

function hideTooltip() {
  const tooltips = document.querySelectorAll(".tooltip");
  tooltips.forEach((tooltip) => tooltip.remove());
}

function setupAccessibility() {
  // Add aria-labels and roles
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.setAttribute("role", "log");
  chatMessages.setAttribute("aria-live", "polite");

  // Ensure all interactive elements are keyboard accessible
  const interactiveElements = document.querySelectorAll(
    'button, input, textarea, [role="button"]'
  );
  interactiveElements.forEach((element) => {
    if (!element.getAttribute("tabindex")) {
      element.setAttribute("tabindex", "0");
    }
  });

  // Add screen reader announcements for status changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList.contains("status-message")) {
        const status = mutation.target.textContent;
        announceToScreenReader(status);
      }
    });
  });

  observer.observe(document.getElementById("uploadStatus"), {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function announceToScreenReader(message) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "alert");
  announcement.setAttribute("aria-live", "polite");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}
