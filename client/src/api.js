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

// Resolve a stored file path (`/uploads/...`) against the API origin.
// In dev the Vite proxy serves /uploads from the same origin, so it passes through.
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  const base = import.meta.env.VITE_API_URL;
  if (!base || base.startsWith('/')) return path;
  return base.replace(/\/api$/, '') + path;
}

export default api;
