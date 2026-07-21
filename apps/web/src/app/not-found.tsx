import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center font-sans">
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl font-extrabold tracking-tight text-zinc-800">404</span>
        <h1 className="text-xl font-bold text-white">Page not found</h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
