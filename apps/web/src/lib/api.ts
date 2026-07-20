import axios, { AxiosError } from "axios";

// ─── API Error Type ──────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

/**
 * Normalize any error thrown by Axios into a consistent ApiError.
 */
export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
    const data = axiosErr.response?.data;
    return {
      message: data?.error || data?.message || axiosErr.message || "Request failed",
      status: axiosErr.response?.status || 0,
      code: axiosErr.code,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, status: 0 };
  }
  return { message: "An unknown error occurred", status: 0 };
}

// ─── Axios Instance ──────────────────────────────────────────────────────────

let API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
if (!API_URL.endsWith("/v1")) {
  API_URL = API_URL + "/v1";
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// ─── Request Interceptor: Inject Auth Token ──────────────────────────────────

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("synapse_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: 401 Handling ──────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth state and redirect
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        // Don't redirect if already on auth pages
        if (currentPath !== "/" && currentPath !== "/login" && currentPath !== "/register") {
          localStorage.removeItem("synapse_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);
