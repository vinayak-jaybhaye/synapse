import { create } from "zustand";
import { authApi } from "../services/api/auth";
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
      const { token, user } = await authApi.login(email, password);
      localStorage.setItem("synapse_token", token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.message || "Login failed.";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authApi.register(username, email, password);
      localStorage.setItem("synapse_token", token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.message || "Registration failed.";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("synapse_token");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      localStorage.removeItem("synapse_token");
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  initAuth: async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("synapse_token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    set({ token, isLoading: true });
    try {
      await get().fetchMe();
    } catch (err) {
      // handled inside fetchMe
    } finally {
      set({ isLoading: false });
    }
  },
}));
