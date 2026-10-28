import axios from 'axios';

// In dev, Vite proxies /api to the Express server (see vite.config.js).
// In production the client is served from the same origin as the API,
// so a relative base URL works in both cases.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
