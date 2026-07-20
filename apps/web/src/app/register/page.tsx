"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

/* Password Strength */

function evaluateStrength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (s === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  return { score: 3, label: "Strong", color: "bg-emerald-500" };
}

/* Component */

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const strength = useMemo(() => evaluateStrength(password), [password]);

  useEffect(() => {
    clearError();
    setLocalError(null);
  }, [clearError]);
  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  const validate = useCallback((): string | null => {
    if (username.length < 3) return "Username must be at least 3 characters.";
    if (username.length > 32) return "Username must be at most 32 characters.";
    if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
  }, [username, email, password]);

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
      await register(username, email, password);
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
          <div className="absolute top-[15%] right-[10%] size-[500px] rounded-full bg-violet-600/15 blur-[150px]" />
          <div className="absolute bottom-[15%] left-[15%] size-[400px] rounded-full bg-indigo-600/10 blur-[130px]" />
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
          <Link href="/" className="flex items-center gap-3 w-fit">
            <Image src="/synapse-logo.svg" alt="Synapse" width={32} height={32} />
            <span className="text-xl font-bold tracking-tight text-white">Synapse</span>
          </Link>

          <div className="max-w-sm">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white mb-4">
              Create your own
              <br />
              corner of the internet.
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Build a server for your friends, your community, or just for fun. It&apos;s all up to
              you.
            </p>
          </div>

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
          {/* Mobile logo */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/synapse-logo.svg" alt="Synapse" width={28} height={28} />
              <span className="text-lg font-bold tracking-tight text-white">Synapse</span>
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              Create your account
            </h1>
            <p className="text-sm text-zinc-500">Join the conversation in seconds</p>
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
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="register-username" className="text-xs font-medium text-zinc-400">
                  Username
                </label>
                <span
                  className={`text-[10px] tabular-nums ${username.length > 28 ? "text-red-400" : "text-zinc-600"}`}
                >
                  {username.length}/32
                </span>
              </div>
              <input
                id="register-username"
                type="text"
                required
                disabled={isLoading}
                value={username}
                maxLength={32}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                placeholder="johndoe"
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="text-xs font-medium text-zinc-400">
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((seg) => (
                      <div
                        key={seg}
                        className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${seg <= strength.score ? strength.color : "bg-zinc-800"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium text-zinc-500">{strength.label}</span>
                </div>
              )}
            </div>

            {/* Submit */}
            <motion.button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </motion.button>

            {/* ToS */}
            <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
              By creating an account you agree to our{" "}
              <a href="#" className="text-zinc-400 hover:text-indigo-400 transition-colors">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" className="text-zinc-400 hover:text-indigo-400 transition-colors">
                Privacy Policy
              </a>
              .
            </p>
          </motion.form>

          {/* Divider */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-600">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </motion.div>

          {/* Switch */}
          <motion.p variants={fadeUp} className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              id="link-to-login"
              href="/login"
              className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Sign in
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
