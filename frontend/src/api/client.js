import axios from 'axios';

// API requests go through the Vite proxy (see vite.config.js) to avoid
// CORS and mixed-content issues. Uses a same-origin relative path.
const API_PATH = '/GeoAttendPro/backend/public';
const BASE = import.meta.env.VITE_API_BASE_URL || API_PATH;

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach session token + CSRF token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gap_token');
  const csrf = localStorage.getItem('gap_csrf');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (csrf) config.headers['X-CSRF-Token'] = csrf;
  return config;
});

// Global 401 handling: session expired -> clear + redirect to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gap_token');
      localStorage.removeItem('gap_csrf');
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

/** Extract a human-readable error message from an axios error. */
export function apiError(err, fallback = 'Something went wrong.') {
  // No response at all → backend not reachable / CORS / network.
  if (err && !err.response) {
    return `Cannot reach the server at ${BASE}. Is XAMPP Apache running?`;
  }
  const data = err?.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first)) return first[0];
  }
  return data?.message || fallback;
}

export { BASE as API_BASE };
export default api;
