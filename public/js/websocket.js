class WebSocketService {
  constructor() {
    this.ws = null;
    this.connectionStatus = document.getElementById("connectionStatus");
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(CONFIG.API.WS_PATH);
    this.updateConnectionStatus("connecting");

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
  }

  updateConnectionStatus(status, message = "") {
    this.connectionStatus.classList.remove(
      "hidden",
      "bg-yellow-100",
      "bg-green-100",
      "bg-red-100"
    );

    switch (status) {
      case "connecting":
        this.connectionStatus.classList.add("bg-yellow-100");
        this.connectionStatus.textContent = "Connecting...";
        break;
      case "connected":
        this.connectionStatus.classList.add("bg-green-100", "text-green-800");
        this.connectionStatus.textContent = "Connected";
        setTimeout(() => {
          this.connectionStatus.classList.add("hidden");
        }, CONFIG.UI.CONNECTION_HIDE_DELAY);
        break;
      case "error":
        this.connectionStatus.classList.add("bg-red-100", "text-red-800");
        this.connectionStatus.textContent = message || "Connection error";
        break;
    }
  }

  handleOpen() {
    this.updateConnectionStatus("connected");
  }

  handleClose() {
    this.updateConnectionStatus("error", "Disconnected. Reconnecting...");
    setTimeout(() => this.connect(), CONFIG.UI.RECONNECT_DELAY);
  }

  handleError(error) {
    console.error("WebSocket error:", error);
    this.updateConnectionStatus("error", "Connection error");
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      // Handle both types of response formats
      if (data.type === "response") {
        // Check if the message is an array (old format)
        if (Array.isArray(data.message)) {
          data.message.forEach((msg) => {
            chatManager.handleResponse({
              type: "response",
              message: msg,
              isComplete: false,
            });
          });
          // Send a completion message
          chatManager.handleResponse({
            type: "response",
            message: "",
            isComplete: true,
          });
        } else {
          // Handle normal message format
          chatManager.handleResponse(data);
        }
      } else if (data.type === "error") {
        chatManager.handleError(data);
      } else if (data.type === "documentUpdate") {
        uploadManager.handleDocumentUpdate(data);
      } else {
        console.warn("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error handling message:", error, event.data);
      chatManager.handleError({ message: "Error processing server response" });
    }
  }

  sendMessage(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      chatManager.handleError({
        message: "Connection lost. Please try again.",
      });
    }
  }
}

const wsService = new WebSocketService();
