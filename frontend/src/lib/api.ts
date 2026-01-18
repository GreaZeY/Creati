import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from './constants';

// Create axios instance with defaults
export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors consistently
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message: string }>) => {
        // Logout on 401
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
        }

        // Return user-friendly error message
        const message = error.response?.data?.message || 'An error occurred';
        return Promise.reject(new Error(message));
    }
);

// API service methods (following Single Responsibility Principle)

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    register: (email: string, password: string) =>
        api.post('/auth/register', { email, password }),

    logout: () => {
        localStorage.removeItem('auth_token');
    },
};

export const preferencesAPI = {
    save: (preferences: Record<string, unknown>) =>
        api.post('/preferences', preferences),

    get: () =>
        api.get('/preferences'),
};

export const platformsAPI = {
    list: () =>
        api.get('/platforms'),

    connect: (platform: string) =>
        api.get(`/platforms/${platform}/connect`),

    disconnect: (platform: string) =>
        api.delete(`/platforms/${platform}`),
};

export const videosAPI = {
    initUpload: (metadata: Record<string, unknown>) =>
        api.post('/videos/init', metadata),

    confirmUpload: (videoId: string, platforms: string[]) =>
        api.post('/videos/confirm', { videoId, platforms }),

    list: () =>
        api.get('/videos'),

    getStatus: (videoId: string) =>
        api.get(`/videos/${videoId}/status`),
};
