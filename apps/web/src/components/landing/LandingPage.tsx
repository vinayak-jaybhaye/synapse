"use client";

import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Subtle backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <header className="relative w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-zinc-900/60 z-10">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider shadow-lg shadow-indigo-600/20">
            S
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Synapse</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            id="landing-login-btn"
            href="/login"
            className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Open App
          </Link>
          <Link
            id="landing-register-btn"
            href="/register"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all duration-150 shadow-md shadow-indigo-600/15"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative flex-1 w-full max-w-5xl mx-auto px-6 flex flex-col items-center justify-center text-center gap-8 z-10 py-16">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-indigo-400 text-xs font-semibold tracking-wide uppercase">
          ⚡ Introducing Synapse Realtime
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none max-w-3xl">
          Where conversations <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            flow instantly.
          </span>
        </h1>
        <p className="text-zinc-400 text-base md:text-xl max-w-2xl leading-relaxed">
          Synapse is an open-source, ultra-fast real-time messaging and voice community app. Built
          on Go and React/Next.js for speed, stability, and scale.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <Link
            id="hero-open-app-btn"
            href="/login"
            className="bg-white text-zinc-950 font-bold px-8 py-4 rounded-xl hover:bg-zinc-100 transition-all duration-200 shadow-xl hover:shadow-white/5 active:scale-[0.98] text-center"
          >
            Open Synapse in browser
          </Link>
          <Link
            id="hero-github-btn"
            href="/register"
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold px-8 py-4 rounded-xl hover:bg-zinc-800 hover:text-white transition-all duration-200 active:scale-[0.98] text-center"
          >
            Create Account
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900/80 flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-500 text-sm z-10">
        <div>© {new Date().getFullYear()} Synapse. All rights reserved.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-300">
            Docs
          </a>
          <a href="#" className="hover:text-zinc-300">
            GitHub
          </a>
          <a href="#" className="hover:text-zinc-300">
            Terms
          </a>
          <a href="#" className="hover:text-zinc-300">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
