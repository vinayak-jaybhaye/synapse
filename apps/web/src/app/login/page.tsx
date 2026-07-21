"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

/* Animation */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
} as const;

/* Component */

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalError(null);
  }, [clearError]);
  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  const validate = useCallback((): string | null => {
    if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email address.";
    if (!password) return "Password is required.";
    return null;
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    const err = validate();
    if (err) {
      setLocalError(err);
      return;
    }
    try {
      await login(email, password);
      router.push("/");
    } catch {
      /* store handles */
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen bg-zinc-950 font-sans select-none">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between overflow-hidden">
        {/* Ambient glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-[20%] left-[15%] size-[500px] rounded-full bg-indigo-600/15 blur-[150px]" />
          <div className="absolute bottom-[10%] right-[10%] size-[400px] rounded-full bg-violet-600/10 blur-[130px]" />
        </div>

        {/* Grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 w-fit">
            <Image src="/synapse-logo.svg" alt="Synapse" width={32} height={32} />
            <span className="text-xl font-bold tracking-tight text-white">Synapse</span>
          </Link>

          {/* Tagline */}
          <div className="max-w-sm">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white mb-4">
              Your people are waiting.
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Jump back into your servers, catch up on conversations, and pick up right where you
              left off.
            </p>
          </div>

          {/* Subtle footer */}
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Synapse</p>
        </div>
      </div>

      {/* Right: Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[380px] flex flex-col gap-8"
        >
          {/* Mobile logo (hidden on desktop where left panel shows it) */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/synapse-logo.svg" alt="Synapse" width={28} height={28} />
              <span className="text-lg font-bold tracking-tight text-white">Synapse</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Welcome back</h1>
            <p className="text-sm text-zinc-500">Enter your credentials to continue</p>
          </motion.div>

          {/* Error */}
          <AnimatePresence mode="wait">
            {displayError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
                  <span>{displayError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <motion.form
            variants={fadeUp}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-medium text-zinc-400">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs text-zinc-500 transition-colors hover:text-indigo-400"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Divider */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-600">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </motion.div>

          {/* Switch */}
          <motion.p variants={fadeUp} className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link
              id="link-to-register"
              href="/register"
              className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Create one
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
