"use client";

import React, { useState } from "react";
import { useGuilds } from "../../services/query/useGuilds";
import { useGuildStore } from "../../store/guild-store";
import { useUIStore } from "../../store/ui-store";
import { useAuthStore } from "../../store/auth-store";
import { Plus, Compass, ShieldAlert } from "lucide-react";
import { getMediaUrl } from "../../lib/media";

export default function GuildList() {
  const { guilds } = useGuilds();
  const { activeGuildId, selectGuild } = useGuildStore();
  const { setShowCreateGuild, setShowJoinGuild, setShowSettings } = useUIStore();
  const { user } = useAuthStore();

  const handleGuildSelect = (guildId: string | null) => {
    selectGuild(guildId);
  };

  return (
    <nav
      className="flex-1 flex flex-col items-center justify-between h-full w-full"
      aria-label="Guild navigation"
    >
      {/* Upper Section */}
      <div className="flex flex-col items-center space-y-2 w-full">
        {/* Direct Messages Icon (represented as Home/Initials) */}
        <button
          onClick={() => handleGuildSelect(null)}
          className={`h-12 w-12 rounded-3xl flex items-center justify-center font-bold text-white transition-all duration-200 cursor-pointer ${
            activeGuildId === null
              ? "rounded-2xl bg-indigo-500 text-white"
              : "bg-bg-secondary text-text-secondary hover:rounded-2xl hover:bg-indigo-500 hover:text-white"
          }`}
          title="Direct Messages"
        >
          <span>DM</span>
        </button>

        <div className="w-8 h-[2px] bg-border-custom rounded shrink-0" />

        {/* Guild Items */}
        <div className="flex flex-col items-center space-y-2 w-full overflow-y-auto max-h-[calc(100vh-280px)] no-scrollbar">
          {guilds.map((g) => {
            const initials = g.name.substring(0, 2).toUpperCase();
            const isActive = g.id === activeGuildId;

            return (
              <button
                key={g.id}
                onClick={() => handleGuildSelect(g.id)}
                className={`h-12 w-12 rounded-3xl flex items-center justify-center font-semibold text-sm transition-all duration-200 cursor-pointer select-none relative ${
                  isActive
                    ? "rounded-2xl bg-indigo-500 text-white"
                    : "bg-bg-secondary text-text-secondary hover:rounded-2xl hover:bg-indigo-500 hover:text-white"
                }`}
                title={g.name}
              >
                {/* Active marker pill */}
                {isActive && (
                  <div className="absolute left-0 w-1 h-10 bg-white rounded-r-md -ml-3" />
                )}
                {g.icon_key ? (
                  <img
                    src={getMediaUrl(g.icon_key)}
                    alt={g.name}
                    className={`w-full h-full object-cover ${isActive ? "rounded-2xl" : "rounded-3xl hover:rounded-2xl"} transition-all duration-200`}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </button>
            );
          })}

          {/* Add Guild Button */}
          <button
            onClick={() => setShowCreateGuild(true)}
            className="h-12 w-12 rounded-3xl bg-bg-secondary text-green-500 hover:text-white hover:bg-green-500 hover:rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer"
            title="Create a Guild"
            aria-label="Create a Guild"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Join Guild Button */}
          <button
            onClick={() => setShowJoinGuild(true)}
            className="h-12 w-12 rounded-3xl bg-bg-secondary text-indigo-400 hover:text-white hover:bg-indigo-500 hover:rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer"
            title="Join Server"
            aria-label="Join Server"
          >
            <Compass className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Lower Section (Profile / Settings) */}
      <div className="flex flex-col items-center pb-2 w-full shrink-0">
        <button
          onClick={() => setShowSettings(true)}
          className="h-11 w-11 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs select-none overflow-hidden cursor-pointer hover:rounded-2xl transition-all duration-200"
          title="User Settings"
          aria-label="User Settings"
        >
          {user?.avatar_key ? (
            <img
              src={getMediaUrl(user.avatar_key)}
              alt={user.username}
              className="w-full h-full object-cover"
            />
          ) : user?.username ? (
            user.username.substring(0, 2).toUpperCase()
          ) : (
            "U"
          )}
        </button>
      </div>
    </nav>
  );
}
