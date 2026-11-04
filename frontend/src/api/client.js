import axios from 'axios';

const baseURL = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export const http = axios.create({ baseURL, timeout: 30000 });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('by_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Normalise API errors into Error objects with .code / .status / .details */
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const e = new Error(err.response?.data?.error?.message || (err.code === 'ECONNABORTED' ? 'Request timed out' : 'Network error - is the API running?'));
    e.code = err.response?.data?.error?.code;
    e.status = err.response?.status;
    e.details = err.response?.data?.error?.details;
    return Promise.reject(e);
  },
);

export const apiBase = baseURL;
