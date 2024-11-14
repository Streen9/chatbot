# Document Chat AI

## Overview

Document Chat AI is a web application that allows users to upload documents (PDF and JSON) and interact with them through a chat interface powered by AI. Users can ask questions about the content of the documents, and the AI will provide relevant answers based on the uploaded material.

## Features

- **File Upload**: Users can upload PDF and JSON files.
- **Chat Interface**: A user-friendly chat interface for interacting with the AI.
- **Real-time Responses**: The AI provides answers in real-time based on the document content.
- **Markdown Support**: Responses are formatted using Markdown for better readability.
- **WebSocket Integration**: Real-time communication between the client and server.

## Technologies Used

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js, Express
- **WebSocket**: For real-time communication
- **AI Integration**: Google Generative AI for processing queries
- **File Handling**: Multer for file uploads, pdf-parse for PDF processing

## Setup Instructions

### Prerequisites

- Node.js (version 18 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/document-chat-ai.git
   cd document-chat-ai
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your environment variables:

   ```plaintext
   GEMINI_API_KEY=your_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

4. Create necessary directories:

   ```bash
   mkdir uploads logs
   ```

### Running the Application

To start the application in development mode, run:
