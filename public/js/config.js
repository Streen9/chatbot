// // Configuration
// const CONFIG = {
//   // WebSocket
//   WS_RECONNECT_DELAY: 3000,
//   WS_HEARTBEAT_INTERVAL: 30000,

//   // Upload
//   MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
//   ALLOWED_FILE_TYPES: [".pdf", ".json"],
//   UPLOAD_ENDPOINT: "/api/upload", // Updated to match backend endpoint

//   // UI
//   STATUS_HIDE_DELAY: 2000,
//   MAX_FILENAME_LENGTH: 40,

//   // Markdown
//   MARKED_OPTIONS: {
//     gfm: true,
//     breaks: true,
//     highlight: function (code, language) {
//       if (language && hljs.getLanguage(language)) {
//         try {
//           return hljs.highlight(code, { language }).value;
//         } catch (err) {}
//       }
//       return code;
//     },
//   },
// };

// // Initialize marked options
// marked.setOptions(CONFIG.MARKED_OPTIONS);


const CONFIG = {
    API: {
        UPLOAD_ENDPOINT: '/api/upload',
        WS_PATH: window.location.protocol === 'https:' ? 'wss:' : 'ws:' + '//' + window.location.host,
    },
    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['.pdf', '.json']
    },
    UI: {
        CONNECTION_HIDE_DELAY: 2000,
        RECONNECT_DELAY: 3000
    }
};