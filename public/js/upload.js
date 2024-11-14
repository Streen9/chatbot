class UploadManager {
  constructor() {
    this.uploadForm = document.getElementById("uploadForm");
    this.fileInput = document.getElementById("fileInput");
    this.uploadStatus = document.getElementById("uploadStatus");

    this.uploadForm.addEventListener("submit", this.handleSubmit.bind(this));
  }

  async handleSubmit(e) {
    e.preventDefault();
    const file = this.fileInput.files[0];

    if (!file) {
      this.updateStatus("Please select a file", "error");
      return;
    }

    if (!this.validateFile(file)) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    this.updateStatus("Uploading...", "info");

    try {
      const response = await fetch(CONFIG.API.UPLOAD_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        throw new Error("Server returned an invalid response");
      }

      if (response.ok) {
        this.updateStatus(
          "File uploaded and processed successfully!",
          "success"
        );
        this.fileInput.value = "";
      } else {
        throw new Error(data.error || "Error uploading file");
      }
    } catch (error) {
      console.error("Upload error:", error);
      this.updateStatus(
        error.message === "Server returned an invalid response"
          ? "Server error. Please try again or contact support."
          : error.message || "Error uploading file",
        "error"
      );
    }
  }

  validateFile(file) {
    // Check file size
    if (file.size > CONFIG.UPLOAD.MAX_FILE_SIZE) {
      this.updateStatus("File is too large. Maximum size is 10MB", "error");
      return false;
    }

    // Check file type
    const fileExt = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));
    if (!CONFIG.UPLOAD.ALLOWED_TYPES.includes(fileExt)) {
      this.updateStatus(
        "Invalid file type. Please upload a PDF or JSON file",
        "error"
      );
      return false;
    }

    return true;
  }

  updateStatus(message, type) {
    this.uploadStatus.textContent = message;
    this.uploadStatus.className =
      "text-sm " +
      (type === "error"
        ? "text-red-600"
        : type === "success"
        ? "text-green-600"
        : type === "info"
        ? "text-blue-600"
        : "text-gray-600");
  }

  handleDocumentUpdate(data) {
    this.updateStatus("File uploaded and processed successfully!", "success");
    chatManager.addMessage(
      "system",
      "Document loaded successfully. You can now ask questions about it."
    );
  }
}

const uploadManager = new UploadManager();
