import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "./constants";
import { toast } from "@/lib/events";

// Extend Axios config to support 'enableAlerts'
declare module "axios" {
  export interface AxiosRequestConfig {
    enableAlerts?: boolean;
  }
}
export interface UnifiedJob {
  id: string;
  jobType: string;
  ruleId: number;
  ruleName: string;
  status: string;
  progress: string;
  sources: Array<{
    handle: string;
    platform: string;
    status: string;
    error?: string;
  }>;
  targets: Array<{
    handle: string;
    platform: string;
    status: string;
    error?: string;
    contentTitle?: string;
  }>;
  contents: Array<{
    id: string;
    title: string;
  }>;
  errorMessage?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface AlertPhone {
  label: string;
  phone: string;
}

export interface Client {
  id: number;
  name: string;
  color: string;
  logoUrl?: string;
  orgName?: string;
  displayOrder?: number;
  brandVoice?: string;
  targetAudience?: string;
  avoidKeywords?: string;
  shareToken?: string;
  shareEnabled?: boolean;
  createdAt: string;
}

export interface TopVideo {
  id: number;
  title: string;
  thumbnailUrl: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  sourcePlatform: string;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture_url?: string;
  createdAt: string;
}

export interface AuthResponse {
  token?: string;
  user: User;
}

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
    api.post<ApiResponse<AuthResponse>>("/auth/login", { email, password }),
  register: (email: string, password: string, firstName?: string, lastName?: string) =>
    api.post<ApiResponse<AuthResponse>>("/auth/register", { 
      email, 
      password,
      firstName,
      lastName
    }),
  googleLogin: (idToken: string, firstName?: string, lastName?: string) =>
    api.post<ApiResponse<AuthResponse>>("/auth/google", {
      idToken,
      firstName,
      lastName,
    }),
  logout: () => api.post<ApiResponse<null>>("/auth/logout", {}),
  check: () => api.get<ApiResponse<AuthResponse>>("/auth/me"),
  updateProfile: (data: {
    firstName: string;
    lastName: string;
    name: string;
    picture_url: string;
  }) => api.put<ApiResponse<null>>("/auth/profile", data),
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
  init: (data: {
    filename: string;
    contentTitle: string;
    sourceHandle?: string;
    targetHandle?: string;
    size: number;
  }) =>
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

  triggerShorts: (videoId: number) => api.post(`/videos/${videoId}/shorts`),
};

export const analyticsAPI = {
  getOverview: (clientId?: number, isGlobal?: boolean) => {
    let url = "/analytics/overview";
    const params = new URLSearchParams();
    if (clientId) params.append("clientId", clientId.toString());
    if (isGlobal) params.append("global", "true");
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    return api.get(url);
  },
};

export interface PublicReportData {
  clientName: string;
  logoUrl: string;
  brandColor: string;
  metrics: {
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    platformBreakdown: Array<{
      platform: string;
      views: number;
    }>;
    pulseData: Array<{
      name: string;
      reach: number;
      engagement: number;
    }>;
    topVideos: TopVideo[];
  };
}
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

  update: (id: number, data: any) =>
    api.put<ApiResponse>(`/automation/${id}/full`, data),

  delete: (id: number) => api.delete<ApiResponse>(`/automation/${id}`),

  blast: (
    data: {
      sourceAccountId: number;
      videoIds: string[];
      videos?: Array<{ id: string; settings?: any }>;
      targets: { accountId: number; captionTemplate: string }[];
      scheduledAt?: Date;
    },
    clientId?: number,
  ) =>
    api.post<ApiResponse>(
      `/automation/blast` + (clientId ? `?clientId=${clientId}` : ""),
      data,
    ),


  retryExecution: (id: string) =>
    api.post<ApiResponse>(`/automation/executions/${id}/retry`),

  cancelExecution: (id: string) =>
    api.post<ApiResponse>(`/automation/executions/${id}/cancel`),

  pauseExecution: (id: string) =>
    api.post<ApiResponse>(`/automation/executions/${id}/pause`),

  listJobs: (limit: number = 20, offset: number = 0, clientId?: number) =>
    api.get<ApiResponse<any[]>>(
      `/automation/jobs?limit=${limit}&offset=${offset}` + (clientId ? `&clientId=${clientId}` : "")
    ),

  getJobDetails: (id: string) =>
    api.get<ApiResponse<any[]>>(`/automation/jobs/${id}/details`),

  retryRule: (id: number) =>
    api.post<ApiResponse>(`/automation/rules/${id}/retry`),
};


export const agencyAPI = {
  listClients: () => api.get<ApiResponse<Client[]>>('/agency/clients'),
  getClient: (id: number) => api.get<ApiResponse<Client>>(`/agency/clients/${id}`),
  createClient: (name: string, color?: string) => api.post('/agency/clients', { name, color }),
  updateClient: (id: number, data: { name?: string; color?: string; brandVoice?: string; targetAudience?: string; avoidKeywords?: string }) =>
    api.put(`/agency/clients/${id}`, data),
  deleteClient: (id: number) => api.delete(`/agency/clients/${id}`),
  reorderClients: (order: number[]) => api.put('/agency/clients/reorder', { order }),
  commitClients: (clients: Client[]) => api.put('/agency/clients/commit', { clients }),
  createIntakeLink: () => api.post<ApiResponse<{ token: string; url: string }>>('/agency/intake-link'),
  createApprovalLink: (id: number) => api.post<ApiResponse<{ token: string; url: string }>>(`/agency/approval-link/${id}`),
  listTeam: () => api.get<ApiResponse<any[]>>('/agency/team'),
  inviteMember: (email: string, role: string) => api.post('/agency/team/invite', { email, role }),
  updateMemberRole: (memberId: number, role: string) => api.put(`/agency/team/${memberId}/role`, { role }),
  removeMember: (memberId: number) => api.delete(`/agency/team/${memberId}`),
  generateReport: () => api.get<ApiResponse<any>>('/agency/reports'),
  listApprovals: () => api.get<ApiResponse<any[]>>('/agency/approvals'),
  getIdentity: (clientId: number) => api.get<ApiResponse<any>>(`/agency/clients/${clientId}/identity`),
  updateIdentity: (clientId: number, data: any) => api.put(`/agency/clients/${clientId}/identity`, data),
  generateIdentity: (clientId: number, url: string) => api.post<ApiResponse<any>>(`/agency/clients/${clientId}/identity/generate`, { url }),
  getComments: (videoId: number) => api.get<ApiResponse<any[]>>(`/agency/videos/${videoId}/comments`),
  addComment: (videoId: number, content: string, isInternal: boolean) => api.post(`/agency/videos/${videoId}/comments`, { content, isInternal }),
  search: (query: string) => api.get<ApiResponse<any[]>>(`/agency/search?q=${query}`),
  getWhatsAppAlerts: () => api.get<ApiResponse<AlertPhone[]>>('/agency/settings/whatsapp-alerts'),
  updateWhatsAppAlerts: (phones: AlertPhone[]) => api.put<ApiResponse<AlertPhone[]>>('/agency/settings/whatsapp-alerts', phones),
};

export const publicAPI = {
  getReport: (token: string) => api.get<ApiResponse<PublicReportData>>(`/pub/reports/${token}`),
  getBranding: () => api.get<ApiResponse<any>>('/pub/branding'),
  getComments: (token: string) => api.get<ApiResponse<any[]>>(`/pub/videos/approval/${token}/comments`),
  addComment: (token: string, content: string) => api.post(`/pub/videos/approval/${token}/comments`, { content }),
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

export const aiAPI = {
  getCredits: () => api.get<ApiResponse<{ credits: number }>>("/ai/credits"),
  generate: (data: {
    topic: string;
    tone: string;
    goal: string;
    platform?: string;
  }) =>
    api.post<ApiResponse<{ text: string; creditsRemaining: number }>>(
      "/ai/generate",
      data,
    ),
  rewrite: (data: { originalText: string; platform: string; tone: string }) =>
    api.post<ApiResponse<{ text: string; creditsRemaining: number }>>(
      "/ai/rewrite",
      data,
    ),
  chat: (data: { conversationId?: string; message: string }) =>
    api.post<ApiResponse<{ conversationId: string; message: string; history: any[] }>>(
      "/ai/chat",
      data,
    ),
};

export const mediaAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<ApiResponse<{ id: string; url: string; type: string }>>(
      "/media/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // 60s for large files
      }
    );
  },
};

export const postsAPI = {
  create: (data: {
    text: string;
    platformIds: string[];
    mediaIds?: string[];
    scheduledAt?: Date;
  }, clientId?: number) =>
    api.post<ApiResponse<{ id: string; jobIds: string[] }>>(
      "/posts" + (clientId ? `?clientId=${clientId}` : ""),
      data,
    ),
  getCalendar: (start?: string, end?: string) =>
    api.get<ApiResponse<any>>(`/agency/calendar${start ? `?start=${start}` : ""}${end ? (start ? "&" : "?") + `end=${end}` : ""}`),
  batchUpdateStatus: (ids: string[], status: string) =>
    api.put<ApiResponse>(`/agency/calendar/batch`, { ids, status }),
};
