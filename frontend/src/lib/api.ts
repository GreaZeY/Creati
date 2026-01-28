import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from './constants';
import { toast } from '@/lib/events';

// Extend Axios config to support 'enableAlerts'
declare module 'axios' {
    export interface AxiosRequestConfig {
        enableAlerts?: boolean;
    }
}

export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}

// Create axios instance with defaults
// Create axios instance with defaults
export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // IMPORTANT: Send cookies
    timeout: 15000,
});

// Helper to read cookie by name
const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};

// Request interceptor - add CSRF token
api.interceptors.request.use(
    (config) => {
        // We no longer attach Authorization: Bearer. Cookies handle JWT.

        // Anti-CSRF: Read token from cookie and send in header
        const csrfToken = getCookie('csrf_token');
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors consistently
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message: string, error: string }>) => {
        // Logout on 401
        if (error.response?.status === 401) {
            // No local storage to clear, just redirect
            // Prevent loop if already on login
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }

        const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong!';

        // Check config to see if alerts should be shown (default: true)
        // Note: config might be undefined if error happened before request
        const shouldShowAlert = error.config?.enableAlerts !== false;

        if (shouldShowAlert && error.response?.status !== 401) {
            toast.error(message);
        }

        return Promise.reject(new Error(message));
    }
);

// API service methods (following Single Responsibility Principle)

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    register: (email: string, password: string) =>
        api.post('/auth/register', { email, password }),

    // Check session on load
    check: () =>
        api.get('/auth/me'),

    logout: () =>
        api.post('/auth/logout'),
};

export const preferencesAPI = {
    save: (preferences: Record<string, unknown>) =>
        api.post('/preferences', preferences),

    get: () =>
        api.get('/preferences'),
};

export const platformsAPI = {
    list: () =>
        api.get<ApiResponse<any[]>>('/platforms'),

    getCount: () =>
        api.get<ApiResponse<Record<string, number>>>('/platforms/count'),

    connect: (platform: string) =>
        api.get(`/platforms/${platform}/connect`),

    disconnect: (platform: string) =>
        api.put(`/platforms/${platform}/disconnect`),

    remove: (platform: string) =>
        api.delete(`/platforms/${platform}`),

    exchange: (platform: string, code: string, state: string) =>
        api.post(`/platforms/${platform}/callback`, { code, state }),

    getVideos: (platform: string, accountId: number) =>
        api.get<ApiResponse<any[]>>(`/platforms/${platform}/videos?accountId=${accountId}`),
};

export const uploadAPI = {
    init: (data: { filename: string; contentType: string; size: number }) =>
        api.post<ApiResponse<{ uploadUrl: string; key: string }>>('/upload/init', data),

    confirm: (data: { key: string; title: string; description: string; platforms?: string[]; accountIds?: number[] }) =>
        api.post<ApiResponse>('/upload/confirm', data),
};

export const videosAPI = {
    list: () =>
        api.get('/videos'),

    getStatus: (videoId: string) =>
        api.get(`/videos/${videoId}/status`),

    getAnalytics: (videoId: string) =>
        api.get(`/videos/${videoId}/analytics`),
};

export const analyticsAPI = {
    getOverview: () =>
        api.get('/analytics/overview'),
};
export const automationAPI = {
    list: () =>
        api.get<ApiResponse<any[]>>('/automation'),

    create: (data: any) =>
        api.post<ApiResponse<{ id: number }>>('/automation', data),

    toggle: (id: number, isActive: boolean) =>
        api.put<ApiResponse>(`/automation/${id}`, { isActive }),

    delete: (id: number) =>
        api.delete<ApiResponse>(`/automation/${id}`),

    blast: (data: { sourceAccountId: number; videoIds: string[]; targets: { accountId: number; captionTemplate: string }[] }) =>
        api.post<ApiResponse>(`/automation/blast`, data),

    getBlastSummary: (id: number) =>
        api.get<ApiResponse>(`/automation/rules/${id}/summary`),
};

export const paymentsAPI = {
    createSubscription: (planId: string, billingCycle: string) =>
        api.post<{ success: boolean; data: any }>('/payments/create-subscription', { planId, billingCycle }),

    verifySubscription: (data: any) =>
        api.post('/payments/verify-subscription', data),

    updateSubscription: (targetPlanId: string, billingCycle: string) =>
        api.put('/payments/subscription', { targetPlanId, billingCycle }),

    getSubscription: () =>
        api.get('/payments/subscription'),

    cancelSubscription: () =>
        api.delete('/payments/subscription'),
};
