"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore();
  const {
    guilds,
    activeGuildId,
    channels,
    activeChannelId,
    messages,
    members,
    isLoading: chatLoading,
    error: chatError,
    fetchGuilds,
    selectGuild,
    createGuild,
    createChannel,
    fetchMessages,
    sendMessage,
    createInvite,
    joinGuild,
    clearChat,
  } = useChatStore();

  // Modals state
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [guildName, setGuildName] = useState("");
  
  const [showJoinGuild, setShowJoinGuild] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState(0); // 0: Text, 1: Voice

  const [inviteSharedCode, setInviteSharedCode] = useState<string | null>(null);

  // Form states
  const [inputMessage, setInputMessage] = useState("");
  const [micActive, setMicActive] = useState(true);
  const [soundActive, setSoundActive] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize and load guilds on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchGuilds();
    } else {
      clearChat();
    }
  }, [isAuthenticated, fetchGuilds, clearChat]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannelId]);

  const handleCreateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!guildName.trim()) return;

    try {
      await createGuild(guildName.trim(), "");
      setGuildName("");
      setShowCreateGuild(false);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleJoinGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!inviteCode.trim()) return;

    try {
      await joinGuild(inviteCode.trim());
      setInviteCode("");
      setShowJoinGuild(false);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!channelName.trim() || !activeGuildId) return;

    try {
      await createChannel(activeGuildId, channelName.trim(), channelType);
      setChannelName("");
      setShowCreateChannel(false);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleGenerateInvite = async () => {
    if (!activeGuildId) return;
    try {
      const code = await createInvite(activeGuildId);
      setInviteSharedCode(code);
    } catch (err: any) {
      alert("Failed to generate invite code: " + err.message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChannelId) return;

    try {
      await sendMessage(activeChannelId, inputMessage.trim());
      setInputMessage("");
    } catch (err: any) {
      // Don't crash message loop
    }
  };

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 font-sans">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold text-3xl">
            S
          </div>
          <span className="text-zinc-400 text-sm font-semibold tracking-wider">Connecting to Synapse...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Welcome Landing Page
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between overflow-hidden font-sans">
        {/* Decorative Gradients */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />

        {/* Top Navbar */}
        <header className="relative w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold text-lg">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Synapse</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              id="landing-login-btn"
              href="/login"
              className="text-sm font-semibold text-zinc-300 hover:text-white px-4 py-2 transition-colors duration-150"
            >
              Log In
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
            Synapse is an open-source, ultra-fast real-time messaging and voice community app. Built on Go and React/Next.js for speed, stability, and scale.
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
            <a href="#" className="hover:text-zinc-300">Docs</a>
            <a href="#" className="hover:text-zinc-300">GitHub</a>
            <a href="#" className="hover:text-zinc-300">Terms</a>
            <a href="#" className="hover:text-zinc-300">Privacy</a>
          </div>
        </footer>
      </div>
    );
  }

  // Active details lookup
  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-200 flex overflow-hidden font-sans select-none relative">
      
      {/* 1. GUILDS SIDEBAR */}
      <div className="w-[72px] bg-zinc-950 flex flex-col items-center py-3 shrink-0 gap-2 border-r border-zinc-900/50">
        {/* Synapse Brand Icon Home */}
        <div className="group relative flex items-center justify-center w-full">
          <div className="absolute left-0 w-1 h-5 bg-white rounded-r-md transition-all duration-200 scale-100 origin-left" />
          <button
            onClick={() => guilds.length > 0 && selectGuild(guilds[0].id)}
            className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
            title="Synapse Home"
          >
            <span className="font-bold text-lg">S</span>
          </button>
        </div>

        <div className="w-8 h-[2px] bg-zinc-800 rounded my-1" />

        {/* Dynamic Guild List */}
        <div className="flex-1 w-full flex flex-col gap-2 overflow-y-auto">
          {guilds.map((g) => {
            const initials = g.name.split(" ").map(n => n[0]).join("").substring(0, 3).toUpperCase();
            const isActive = g.id === activeGuildId;
            return (
              <div key={g.id} className="group relative flex items-center justify-center w-full shrink-0">
                {/* Active Indicator Pill */}
                <div className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 origin-left ${isActive ? "h-10" : "h-2 group-hover:h-5 scale-0 group-hover:scale-100"}`} />
                <button
                  onClick={() => selectGuild(g.id)}
                  className={`w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer relative ${isActive ? "rounded-2xl bg-indigo-500 text-white" : "rounded-3xl bg-zinc-800 hover:rounded-2xl hover:bg-indigo-500 text-zinc-300 hover:text-white"}`}
                  title={g.name}
                >
                  <span className="font-semibold text-xs leading-none">{initials}</span>
                  {g.unread_count > 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-zinc-950">
                      {g.unread_count}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Guild Button */}
        <button
          onClick={() => setShowCreateGuild(true)}
          className="w-12 h-12 rounded-3xl bg-zinc-850 hover:bg-emerald-600 text-emerald-500 hover:text-white flex items-center justify-center hover:rounded-2xl transition-all duration-200 cursor-pointer shrink-0 mt-1"
          title="Create a Guild"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Join Guild Button (Compass icon) */}
        <button
          onClick={() => setShowJoinGuild(true)}
          className="w-12 h-12 rounded-3xl bg-zinc-850 hover:bg-indigo-600 text-zinc-400 hover:text-white flex items-center justify-center hover:rounded-2xl transition-all duration-200 cursor-pointer shrink-0"
          title="Join a Guild with Invite Code"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* NO GUILDS SPLASH VIEW */}
      {guilds.length === 0 ? (
        <div className="flex-1 bg-zinc-900 flex flex-col items-center justify-center p-8 text-center font-sans gap-6">
          <div className="h-20 w-20 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-4xl mb-2">
            🧭
          </div>
          <h2 className="text-3xl font-extrabold text-white">Welcome to Synapse</h2>
          <p className="text-zinc-400 text-base max-w-md leading-relaxed">
            You aren't in any guilds yet. Get started by creating your own guild or join an existing guild with an invite code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <button
              onClick={() => setShowCreateGuild(true)}
              className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              Create a Guild
            </button>
            <button
              onClick={() => setShowJoinGuild(true)}
              className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 font-semibold px-6 py-3 rounded-xl transition-all cursor-pointer"
            >
              Join a Guild
            </button>
          </div>
          <button
            onClick={logout}
            className="text-zinc-500 hover:text-red-400 text-sm mt-8 transition-colors flex items-center gap-1.5"
          >
            Log Out of account
          </button>
        </div>
      ) : (
        <>
          {/* 2. CHANNELS SIDEBAR */}
          <div className="w-60 bg-zinc-900 flex flex-col shrink-0 border-r border-zinc-800/20">
            {/* Guild Header */}
            <div className="h-12 border-b border-zinc-950 flex items-center justify-between px-4 shadow-sm font-bold text-white shrink-0 hover:bg-zinc-800/30 cursor-pointer group">
              <span className="truncate">{activeGuild?.name || "Guild"}</span>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleGenerateInvite(); }}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  title="Generate Invite"
                >
                  ✉️
                </button>
              </div>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between text-zinc-400 text-xxs font-bold uppercase tracking-wider px-2 mb-1.5 select-none">
                  <span>Text Channels</span>
                  <button
                    onClick={() => { setChannelType(0); setShowCreateChannel(true); }}
                    className="hover:text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  {channels.filter(c => c.type === 0).map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => fetchMessages(ch.id)}
                      className={`w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-left font-medium transition-all duration-150 cursor-pointer ${activeChannelId === ch.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"}`}
                    >
                      <span className="text-zinc-500 font-normal">#</span>
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                  {channels.filter(c => c.type === 0).length === 0 && (
                    <span className="text-zinc-600 text-xs italic px-2">No text channels</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-zinc-400 text-xxs font-bold uppercase tracking-wider px-2 mb-1.5 select-none">
                  <span>Voice Channels</span>
                  <button
                    onClick={() => { setChannelType(1); setShowCreateChannel(true); }}
                    className="hover:text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  {channels.filter(c => c.type === 1).map((ch) => (
                    <button
                      key={ch.id}
                      className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-left font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 cursor-pointer"
                    >
                      <span className="text-zinc-500">🔊</span>
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                  {channels.filter(c => c.type === 1).length === 0 && (
                    <span className="text-zinc-600 text-xs italic px-2">No voice channels</span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile footer settings bar */}
            <div className="h-14 bg-zinc-920 border-t border-zinc-950/40 flex items-center justify-between px-2 shrink-0">
              <div className="flex items-center gap-2 hover:bg-zinc-800/50 p-1.5 rounded-lg cursor-pointer max-w-[130px] overflow-hidden">
                <div className="relative shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs select-none">
                  {(user?.username || "U").substring(0, 2).toUpperCase()}
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-[2px] border-zinc-900 rounded-full" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate leading-tight">
                    {user?.username}
                  </span>
                  <span className="text-xxs text-zinc-400 truncate">Online</span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setMicActive(!micActive)}
                  className={`p-1.5 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer ${micActive ? "text-zinc-400" : "text-red-500"}`}
                  title={micActive ? "Mute Mic" : "Unmute Mic"}
                >
                  {micActive ? (
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  ) : (
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setSoundActive(!soundActive)}
                  className={`p-1.5 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer ${soundActive ? "text-zinc-400" : "text-red-500"}`}
                  title={soundActive ? "Deafen" : "Undeafen"}
                >
                  {soundActive ? (
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  ) : (
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </button>

                <button
                  id="logout-btn"
                  onClick={() => { clearChat(); logout(); }}
                  className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Log Out"
                >
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 3. CHAT VIEW AREA */}
          <div className="flex-1 bg-zinc-800 flex flex-col min-w-0">
            {activeChannel ? (
              <>
                {/* Chat Header */}
                <div className="h-12 border-b border-zinc-950 flex items-center justify-between px-4 shadow-sm shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-xl font-normal">#</span>
                    <span className="font-bold text-white text-base leading-none">{activeChannel.name}</span>
                    {activeChannel.topic && (
                      <span className="text-zinc-500 font-medium text-xs border-l border-zinc-700/60 pl-3 ml-1 select-none truncate max-w-sm">
                        {activeChannel.topic}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Log */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex flex-col gap-1 pb-4 border-b border-zinc-700/30">
                    <div className="h-16 w-16 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-white text-3xl select-none mb-2">
                      #
                    </div>
                    <h2 className="text-2xl font-bold text-white">Welcome to #{activeChannel.name}!</h2>
                    <p className="text-zinc-400 text-sm">
                      This is the start of the #{activeChannel.name} channel.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {messages.map((msg) => {
                      const avatarInitials = msg.author_id === user?.id ? (user?.username || "U").substring(0, 2).toUpperCase() : "U";
                      return (
                        <div key={msg.id} className="flex gap-4 group hover:bg-zinc-750/30 -mx-4 px-4 py-1 rounded transition-colors duration-75">
                          <div className="shrink-0 h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-sm mt-0.5 select-none">
                            {avatarInitials}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-white hover:underline cursor-pointer text-sm">
                                {msg.author_id === user?.id ? user.username : `Member ID:${msg.author_id.substring(0, 4)}`}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-medium">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-zinc-300 text-sm mt-1 select-text whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Chat Input Box */}
                <form onSubmit={handleSendMessage} className="p-4 pt-0 shrink-0">
                  <div className="bg-zinc-700/60 border border-zinc-700/20 rounded-xl px-4 py-2.5 flex items-center gap-3 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <input
                      id="chat-message-input"
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={`Message #${activeChannel.name}`}
                      className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder-zinc-500"
                    />
                    <button
                      id="chat-message-submit"
                      type="submit"
                      className="text-zinc-400 hover:text-indigo-400 cursor-pointer shrink-0 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 font-sans gap-2">
                💬
                <span>Select a channel to start conversation</span>
              </div>
            )}
          </div>

          {/* 4. ACTIVE MEMBERS SIDEBAR */}
          <div className="w-60 bg-zinc-900 flex flex-col shrink-0 overflow-y-auto p-3 hidden lg:flex border-l border-zinc-800/10 select-none">
            <h3 className="text-zinc-400 text-xxs font-bold uppercase tracking-wider px-2 mb-2">
              Online — {members.length}
            </h3>
            
            <div className="flex flex-col gap-0.5">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer">
                  <div className="relative h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs select-none">
                    {m.username.substring(0, 2).toUpperCase()}
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-[2px] border-zinc-900 rounded-full" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate">
                      {m.nickname || m.display_name || m.username}
                    </span>
                    {m.is_muted && (
                      <span className="text-[9px] text-red-400">Muted</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ================= MODALS ================= */}

      {/* CREATE GUILD MODAL */}
      {showCreateGuild && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold text-white">Create a Guild</h3>
              <p className="text-zinc-400 text-xs mt-1">Your guild is where you and your friends hang out. Make yours and start chatting!</p>
            </div>
            {actionError && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">{actionError}</div>}
            <form onSubmit={handleCreateGuild} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Guild Name</label>
                <input
                  type="text"
                  required
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 outline-none transition-all"
                  placeholder="e.g. My Awesome Club"
                />
              </div>
              <div className="flex justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateGuild(false); setActionError(null); }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-550 text-white font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN GUILD MODAL */}
      {showJoinGuild && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold text-white">Join a Guild</h3>
              <p className="text-zinc-400 text-xs mt-1">Enter an invite code to join an existing guild community.</p>
            </div>
            {actionError && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">{actionError}</div>}
            <form onSubmit={handleJoinGuild} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Invite Code</label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 outline-none transition-all"
                  placeholder="e.g. SfYpUh6b"
                />
              </div>
              <div className="flex justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => { setShowJoinGuild(false); setActionError(null); }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-550 text-white font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CHANNEL MODAL */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold text-white">Create Channel</h3>
              <p className="text-zinc-400 text-xs mt-1">Add a new workspace channel in the guild.</p>
            </div>
            {actionError && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">{actionError}</div>}
            <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Channel Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-white">
                    <input
                      type="radio"
                      name="channel_type"
                      checked={channelType === 0}
                      onChange={() => setChannelType(0)}
                    />
                    Text (#)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-white">
                    <input
                      type="radio"
                      name="channel_type"
                      checked={channelType === 1}
                      onChange={() => setChannelType(1)}
                    />
                    Voice (🔊)
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Channel Name</label>
                <input
                  type="text"
                  required
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 outline-none transition-all"
                  placeholder="e.g. dev-chat"
                />
              </div>
              <div className="flex justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateChannel(false); setActionError(null); }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-550 text-white font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE / COPY INVITE MODAL */}
      {inviteSharedCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Invite Created!</h3>
              <p className="text-zinc-400 text-xs mt-1">Share this invite code with your friends to let them join your guild.</p>
            </div>
            <div className="flex gap-2 items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
              <span className="flex-1 font-mono text-sm text-indigo-400 font-bold select-all tracking-wider text-center">{inviteSharedCode}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteSharedCode);
                  alert("Copied code to clipboard!");
                }}
                className="bg-indigo-600 text-white font-semibold text-xs rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-550"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end mt-1">
              <button
                onClick={() => setInviteSharedCode(null)}
                className="bg-zinc-800 text-zinc-300 px-4 py-2 text-sm font-semibold rounded-xl hover:bg-zinc-700 hover:text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
