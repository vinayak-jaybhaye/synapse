"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Error Page]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center font-sans">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          An unexpected error occurred. This has been logged automatically.
        </p>
      </div>

      {error.message && (
        <pre className="max-h-24 max-w-lg overflow-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-500">
          {error.message}
        </pre>
      )}

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
