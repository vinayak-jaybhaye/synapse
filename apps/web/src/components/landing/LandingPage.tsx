"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
  useMotionValue,
  type Variants,
} from "framer-motion";
import { Zap, MessageCircle, Shield, Headphones, ArrowRight } from "lucide-react";

/* Animation Variants */

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, type: "spring", bounce: 0.4 },
  },
};

/* Data */

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Real-Time Messaging",
    description:
      "Send messages, react, share files, and embed links — everything arrives instantly.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    accent: "text-blue-400",
    border: "hover:border-blue-500/30",
  },
  {
    icon: Headphones,
    title: "Voice Channels",
    description:
      "Hop into voice channels and hang out. Crystal-clear audio with built-in noise suppression.",
    gradient: "from-violet-500/20 to-purple-500/20",
    accent: "text-violet-400",
    border: "hover:border-violet-500/30",
  },
  {
    icon: Shield,
    title: "Roles & Permissions",
    description:
      "Organize your community with custom roles. Control who can see, post, and moderate.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    accent: "text-emerald-400",
    border: "hover:border-emerald-500/30",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Snappy by design. Messages load instantly, even in the busiest servers.",
    gradient: "from-amber-500/20 to-orange-500/20",
    accent: "text-amber-400",
    border: "hover:border-amber-500/30",
  },
] as const;

const BUILT_WITH = ["Go", "React", "WebSockets", "LiveKit", "PostgreSQL"] as const;

/* Ambient Background */

function AmbientOrbs() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });

  const y1 = useTransform(smooth, [0, 1], [0, -200]);
  const y2 = useTransform(smooth, [0, 1], [0, -150]);
  const y3 = useTransform(smooth, [0, 1], [0, -300]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        style={{ y: y1 }}
        className="absolute -top-[20%] -left-[10%] size-[600px] rounded-full bg-indigo-600/10 blur-[160px] will-change-transform"
      />
      <motion.div
        style={{ y: y2 }}
        className="absolute top-[20%] -right-[15%] size-[500px] rounded-full bg-purple-600/8 blur-[140px] will-change-transform"
      />
      <motion.div
        style={{ y: y3 }}
        className="absolute -bottom-[10%] left-[30%] size-[400px] rounded-full bg-fuchsia-500/6 blur-[120px] will-change-transform"
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

/* 3D Tilt Card */

const SPRING_CFG = { stiffness: 150, damping: 15 } as const;

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const Icon = feature.icon;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, SPRING_CFG);
  const sy = useSpring(my, SPRING_CFG);
  const rotateX = useTransform(sy, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(sx, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    mx.set((e.clientX - left) / width - 0.5);
    my.set((e.clientY - top) / height - 0.5);
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.8, rotateX: 10 }}
      animate={
        inView
          ? {
              opacity: 1,
              y: 0,
              scale: 1,
              rotateX: 0,
              transition: { type: "spring", bounce: 0.4, delay: index * 0.15, duration: 0.8 },
            }
          : {}
      }
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex flex-col gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 backdrop-blur-sm transition-colors duration-300 will-change-transform ${feature.border}`}
    >
      <div
        style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}
        className="relative z-10 flex flex-col gap-4"
      >
        <div
          className={`flex size-11 items-center justify-center rounded-xl bg-zinc-800/80 ${feature.accent} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="size-5" />
        </div>
        <h3 className="text-[15px] font-semibold text-white">{feature.title}</h3>
        <p className="text-sm leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300">
          {feature.description}
        </p>
      </div>
      <div
        style={{ transform: "translateZ(-10px)" }}
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />
    </motion.div>
  );
}

/* Page */

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(heroScroll, [0, 0.7], [1, 0]);
  const heroScale = useTransform(heroScroll, [0, 0.7], [1, 0.85]);
  const heroY = useTransform(heroScroll, [0, 0.7], [0, 100]);

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-zinc-950 font-sans text-zinc-100 select-none"
      style={{ perspective: 1000 }}
    >
      <AmbientOrbs />

      {/* Navbar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04]"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 backdrop-blur-xl bg-zinc-950/60">
          <Link href="/" className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ rotate: [0, -15, 15, -10, 10, 0] }}
              transition={{ duration: 0.6 }}
            >
              <Image src="/synapse-logo.svg" alt="Synapse" width={32} height={32} />
            </motion.div>
            <span className="text-lg font-bold tracking-tight text-white">Synapse</span>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              id="landing-login-btn"
              href="/login"
              className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:inline-flex"
            >
              Log In
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                id="landing-register-btn"
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/30"
              >
                Get Started
                <ArrowRight className="size-3.5" />
              </Link>
            </motion.div>
          </nav>
        </div>
      </motion.header>

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 pt-16 text-center"
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-7"
        >
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.2}
            whileDrag={{ scale: 1.1 }}
            className="inline-flex cursor-grab items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="size-3.5 text-indigo-400" />
            </motion.span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 select-none">
              Chat, Voice & Community
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUp}
            className="max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-8xl"
          >
            Communicate without
            <br />
            <motion.span
              className="inline-block bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% 200%" }}
            >
              compromise.
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg md:text-xl"
          >
            A place to hang out, share ideas, and talk with the people who matter most.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link
                id="hero-open-app-btn"
                href="/login"
                className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-zinc-950 shadow-xl shadow-white/5 transition-shadow hover:shadow-2xl hover:shadow-white/20 sm:text-base"
              >
                Open Synapse
                <ArrowRight className="size-4 animate-[nudge_1.5s_ease-in-out_infinite]" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link
                id="hero-register-btn"
                href="/register"
                className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 px-8 py-4 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white sm:text-base"
              >
                Create Account
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mb-16 flex flex-col items-center gap-4 text-center"
        >
          <motion.span
            variants={fadeUp}
            className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400"
          >
            Features
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Everything you need, <span className="text-zinc-500">nothing you don&apos;t.</span>
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* Built With */}
      <section className="relative z-10 border-y border-zinc-800/40 bg-zinc-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
            Built with
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {BUILT_WITH.map((name, i) => (
              <motion.span
                key={name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: "spring", bounce: 0.3 }}
                className="text-sm font-semibold tracking-wide text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 py-24 sm:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={stagger}
          className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[2.5rem] border border-zinc-800/50 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-10 text-center backdrop-blur-md sm:p-16"
        >
          {/* Glow */}
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-[100%] bg-indigo-600/10 blur-[120px]"
          />

          <motion.h2
            variants={fadeUp}
            className="relative max-w-lg text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Your community awaits.
          </motion.h2>
          <motion.p variants={fadeUp} className="relative max-w-md text-base text-zinc-400">
            Create a server, invite your friends, and start talking. It only takes a minute.
          </motion.p>
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative mt-2"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-2xl hover:shadow-indigo-600/35 sm:text-base"
            >
              Get Started Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/synapse-logo.svg"
              alt="Synapse"
              width={20}
              height={20}
              className="opacity-70"
            />
            <span>© {new Date().getFullYear()} Synapse</span>
          </div>
          <div className="flex gap-6">
            <a
              href="https://github.com/synapse"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <a href="#" className="transition-colors hover:text-white">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
