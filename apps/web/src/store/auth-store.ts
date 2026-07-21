import { create } from "zustand";
import { authApi } from "../services/api/auth";
import { normalizeError } from "../lib/api";
import { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setUser: (user: User) => void;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

function getOrCreateDeviceID(): string {
  if (typeof window === "undefined") return "web-ssr";
  let deviceId = localStorage.getItem("synapse_device_id");
  if (!deviceId) {
    deviceId =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("synapse_device_id", deviceId);
  }
  return deviceId;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const deviceId = getOrCreateDeviceID();
      const { user } = await authApi.login(email, password, deviceId, "web");
      localStorage.setItem("synapse_logged_in", "true");
      localStorage.removeItem("synapse_token");
      set({ token: null, user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message = normalizeError(err).message;
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const deviceId = getOrCreateDeviceID();
      const { user } = await authApi.register(username, email, password, deviceId, "web");
      localStorage.setItem("synapse_logged_in", "true");
      localStorage.removeItem("synapse_token");
      set({ token: null, user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message = normalizeError(err).message;
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("synapse_logged_in");
    localStorage.removeItem("synapse_token");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("synapse_logged_in");
      localStorage.removeItem("synapse_token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  initAuth: async () => {
    if (typeof window === "undefined") return;
    const loggedIn = localStorage.getItem("synapse_logged_in") === "true";
    if (!loggedIn) {
      set({ isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      await get().fetchMe();
    } catch {
      // handled inside fetchMe
    } finally {
      set({ isLoading: false });
    }
  },
}));
