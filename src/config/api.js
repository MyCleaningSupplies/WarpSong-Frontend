// src/config/api.js
const isDevelopment = process.env.NODE_ENV === 'development';

// API configuration
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001' 
  : 'https://warpsong-backend.onrender.com';

const SOCKET_URL = isDevelopment
  ? 'http://localhost:3001'
  : 'https://warpsong-backend.onrender.com';

export { API_BASE_URL, SOCKET_URL };
