// Main application initialization
document.addEventListener("DOMContentLoaded", () => {
  // Initialize marked options for markdown parsing
  marked.setOptions({
    gfm: true,
    breaks: true,
    sanitize: false,
    smartLists: true,
    smartypants: true,
  });

  // Setup global error handler
  window.addEventListener("error", (event) => {
    utils.logError(event.error, "Global error handler");
    chatManager.handleError({
      message: "An unexpected error occurred. Please try again.",
    });
  });

  // Setup global unhandled rejection handler
  window.addEventListener("unhandledrejection", (event) => {
    utils.logError(event.reason, "Unhandled rejection");
    chatManager.handleError({
      message: "An unexpected error occurred. Please try again.",
    });
  });

  // Handle visibility change for WebSocket reconnection
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      wsService.ws.readyState !== WebSocket.OPEN
    ) {
      wsService.connect();
    }
  });

  // Handle online/offline status
  window.addEventListener("online", () => {
    if (wsService.ws.readyState !== WebSocket.OPEN) {
      wsService.connect();
    }
  });

  window.addEventListener("offline", () => {
    chatManager.addMessage(
      "system",
      "You are currently offline. Please check your internet connection."
    );
  });

  // Handle chat window scrolling on window resize
  const handleResize = utils.debounce(() => {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);

  window.addEventListener("resize", handleResize);
});
