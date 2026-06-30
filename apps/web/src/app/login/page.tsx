"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear errors when navigating away or loading the page
  useEffect(() => {
    clearError();
    setLocalError(null);
  }, [clearError]);

  // If already logged in, redirect to home dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // Client-side validations
    if (!email.includes("@") || !email.includes(".")) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setLocalError("Password is required.");
      return;
    }

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      // Handled in store error
    }
  };

  const displayError = localError || error;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-zinc-950 px-4 py-12 select-none overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-[440px] bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-black/80 flex flex-col gap-6 transition-all duration-300 hover:border-zinc-700/50">
        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <div className="flex justify-center mb-1">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold text-xl tracking-wider">
              S
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back!</h1>
          <p className="text-zinc-400 text-sm">We're so excited to see you again!</p>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2.5 animate-fadeIn">
            <svg
              className="h-4 w-4 text-red-400 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1 font-medium">{displayError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-200 disabled:opacity-50"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Password <span className="text-red-500">*</span>
              </label>
              <a href="#" className="text-xs text-indigo-400 hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-200 disabled:opacity-50"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm rounded-xl py-3 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Logging in...</span>
              </>
            ) : (
              <span>Log In</span>
            )}
          </button>
        </form>

        <div className="border-t border-zinc-800/80 pt-4 text-center">
          <span className="text-zinc-500 text-sm">Need an account? </span>
          <Link
            id="link-to-register"
            href="/register"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors duration-150"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
