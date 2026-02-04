import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "./constants";
import { toast } from "@/lib/events";

// Extend Axios config to support 'enableAlerts'
declare module "axios" {
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

export interface Client {
  id: number;
  name: string;
  color?: string;
  orgId?: number;
  displayOrder?: number;
}

// Create axios instance with defaults
// Create axios instance with defaults
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // IMPORTANT: Send cookies
  timeout: 15000,
});

// Helper to read cookie by name
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
};

// Request interceptor - add CSRF token
api.interceptors.request.use(
  (config) => {
    // We no longer attach Authorization: Bearer. Cookies handle JWT.

    // Anti-CSRF: Read token from cookie and send in header
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle errors consistently
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message: string; error: string }>) => {
    // Logout on 401
    if (error.response?.status === 401) {
      // No local storage to clear, just redirect
      // Prevent loop if already on login
      const authPages = ["/login", "/register", "/"];

      if (!authPages.some((path) => window.location.pathname.includes(path))) {
        window.location.href = "/login";
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong!";

    // Check config to see if alerts should be shown (default: true)
    // Note: config might be undefined if error happened before request
    const shouldShowAlert = error.config?.enableAlerts !== false;

    if (shouldShowAlert && error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(new Error(message));
  },
);

// API service methods (following Single Responsibility Principle)

export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  register: (email: string, password: string) =>
    api.post("/auth/register", { email, password }),

  // Check session on load
  check: () => api.get("/auth/me"),

  logout: () => api.post("/auth/logout"),
};

export const preferencesAPI = {
  save: (preferences: Record<string, unknown>) =>
    api.post("/preferences", preferences),

  get: () => api.get("/preferences"),
};

export const platformsAPI = {
  list: (clientId?: number) =>
    api.get<ApiResponse<any[]>>(
      "/platforms" + (clientId ? `?clientId=${clientId}` : ""),
    ),

  getCount: (clientId?: number) =>
    api.get<ApiResponse<Record<string, number>>>(
      "/platforms/counts" + (clientId ? `?clientId=${clientId}` : ""),
    ),

  connect: (platform: string, clientId?: number) =>
    api.get(
      `/platforms/${platform}/connect` +
        (clientId ? `?clientId=${clientId}` : ""),
    ),

  disconnect: (platform: string) =>
    api.put(`/platforms/${platform}/disconnect`),

  remove: (platform: string) => api.delete(`/platforms/${platform}`),

  exchange: (platform: string, code: string, state: string) =>
    api.post(`/platforms/${platform}/callback`, { code, state }),

  getVideos: (platform: string, accountId: number) =>
    api.get<ApiResponse<any[]>>(
      `/platforms/${platform}/videos?accountId=${accountId}`,
    ),
};

export const uploadAPI = {
  init: (data: { filename: string; contentType: string; size: number }) =>
    api.post<ApiResponse<{ uploadUrl: string; key: string }>>(
      "/upload/init",
      data,
    ),

  confirm: (data: {
    key: string;
    title: string;
    description: string;
    platforms?: string[];
    accountIds?: number[];
    clientId?: number;
  }) => api.post<ApiResponse>("/upload/confirm", data),
};

export const videosAPI = {
  list: (clientId?: number) =>
    api.get("/videos" + (clientId ? `?clientId=${clientId}` : "")),

  getStatus: (videoId: string) => api.get(`/videos/${videoId}/status`),

  getAnalytics: (videoId: string) => api.get(`/videos/${videoId}/analytics`),
};

export const analyticsAPI = {
  getOverview: (clientId?: number) =>
    api.get("/analytics/overview" + (clientId ? `?clientId=${clientId}` : "")),
};
export const automationAPI = {
  list: (clientId?: number) =>
    api.get<ApiResponse<any[]>>(
      "/automation" + (clientId ? `?clientId=${clientId}` : ""),
    ),

  create: (data: any, clientId?: number) =>
    api.post<ApiResponse<{ id: number }>>(
      "/automation" + (clientId ? `?clientId=${clientId}` : ""),
      data,
    ),

  toggle: (id: number, isActive: boolean) =>
    api.put<ApiResponse>(`/automation/${id}`, { isActive }),

  delete: (id: number) => api.delete<ApiResponse>(`/automation/${id}`),

  blast: (
    data: {
      sourceAccountId: number;
      videoIds: string[];
      targets: { accountId: number; captionTemplate: string }[];
    },
    clientId?: number,
  ) =>
    api.post<ApiResponse>(
      `/automation/blast` + (clientId ? `?clientId=${clientId}` : ""),
      data,
    ),

  getBlastSummary: (id: number) =>
    api.get<ApiResponse>(`/automation/rules/${id}/summary`),

  retryExecution: (id: string) =>
    api.post<ApiResponse>(`/automation/executions/${id}/retry`),

  retryRule: (id: number) =>
    api.post<ApiResponse>(`/automation/rules/${id}/retry`),
};

export const audienceAPI = {
  listRules: (clientId?: number) =>
    api.get<ApiResponse<any[]>>(
      "/audience/rules" + (clientId ? `?clientId=${clientId}` : ""),
    ),

  createRule: (data: any, clientId?: number) =>
    api.post<ApiResponse>(
      "/audience/rules" + (clientId ? `?clientId=${clientId}` : ""),
      data,
    ),

  deleteRule: (id: string) => api.delete<ApiResponse>(`/audience/rules/${id}`),

  toggleRule: (id: string, enabled: boolean) =>
    api.put<ApiResponse>(`/audience/rules/${id}/toggle`, { enabled }),

  getTemplate: (ruleId: string, platform: string) =>
    api.get<ApiResponse>(
      `/audience/templates?ruleId=${ruleId}&platform=${platform}`,
    ),

  saveTemplate: (data: any) => api.post<ApiResponse>("/audience/templates", data),
};

export const agencyAPI = {
  listClients: () => api.get<ApiResponse<Client[]>>('/agency/clients'),
  createClient: (name: string, color?: string) => api.post('/agency/clients', { name, color }),
  updateClient: (id: number, data: { name?: string; color?: string }) =>
    api.put(`/agency/clients/${id}`, data),
  deleteClient: (id: number) => api.delete(`/agency/clients/${id}`),
  reorderClients: (order: number[]) => api.put('/agency/clients/reorder', { order }),
  commitClients: (clients: Client[]) => api.put('/agency/clients/commit', { clients }),
};

export const paymentsAPI = {
  createSubscription: (planId: string, billingCycle: string) =>
    api.post<{ success: boolean; data: any }>("/payments/create-subscription", {
      planId,
      billingCycle,
    }),

  verifySubscription: (data: any) =>
    api.post("/payments/verify-subscription", data),

  updateSubscription: (targetPlanId: string, billingCycle: string) =>
    api.put("/payments/subscription", { targetPlanId, billingCycle }),

  getSubscription: () => api.get("/payments/subscription"),

  cancelSubscription: () => api.delete("/payments/subscription"),
};
