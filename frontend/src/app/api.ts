import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (
      error.response?.status === 403 &&
      (error.response?.data as { error?: string })?.error === 'PASSWORD_CHANGE_REQUIRED' &&
      !url.includes('/auth/change-password')
    ) {
      localStorage.setItem('forcePasswordChange', 'true');
      window.location.href = '/';
      return Promise.reject(error);
    }
    if (
      error.response?.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register')
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
