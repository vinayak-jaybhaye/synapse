import { create } from "zustand";
import { api } from "../lib/api";

export interface User {
    id: string;
    username: string;
    display_name?: string;
    avatar_key?: string;
    email: string;
}

interface AuthResponse {
    token: string;
    user: User;
}

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

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<AuthResponse>("/auth/login", { email, password });
            const { token, user } = response.data;

            localStorage.setItem("synapse_token", token);
            set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
            const message = err.response?.data?.error || "Login failed. Please check your credentials.";
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<AuthResponse>("/auth/register", { username, email, password });
            const { token, user } = response.data;

            localStorage.setItem("synapse_token", token);
            set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
            const message = err.response?.data?.error || "Registration failed.";
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    logout: () => {
        localStorage.removeItem("synapse_token");
        set({ user: null, token: null, isAuthenticated: false, error: null });
    },

    fetchMe: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get<User>("/users/@me");
            set({ user: response.data, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
            // If token verification fails, clear auth
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
            // errors handled inside fetchMe
        } finally {
            set({ isLoading: false });
        }
    },
}));
