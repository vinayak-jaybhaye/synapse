"use client";

import React from "react";
import { useAuthStore } from "../../../store/auth-store";

export default function ProfileTab() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary">My Profile</h3>
        <p className="text-xs text-text-muted mt-1">Manage your identity details.</p>
      </div>

      <div className="bg-bg-secondary border border-border-custom rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="h-16 w-16 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-2xl">
          {user?.username ? user.username.substring(0, 2).toUpperCase() : "U"}
        </div>
        <div>
          <h4 className="text-sm font-bold text-text-primary">{user?.username}</h4>
          <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
          <span className="inline-block bg-bg-tertiary border border-border-custom text-text-secondary text-[10px] font-semibold rounded px-2 py-0.5 mt-2">
            User Snowflake ID: {user?.id}
          </span>
        </div>
      </div>
    </div>
  );
}
