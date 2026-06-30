"use client";

import React, { useState } from "react";

interface JoinGuildModalProps {
  open: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<any>;
}

export default function JoinGuildModal({ open, onClose, onJoin }: JoinGuildModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inviteCode.trim()) return;

    try {
      await onJoin(inviteCode.trim());
      setInviteCode("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to join guild");
    }
  };

  const handleClose = () => {
    setError(null);
    setInviteCode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-md bg-bg-secondary border border-border-custom rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Join a Guild</h3>
          <p className="text-text-muted text-xs mt-1">
            Enter an invite code to join an existing guild community.
          </p>
        </div>
        {error && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Invite Code
            </label>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-bg-primary border border-border-custom focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-all"
              placeholder="e.g. SfYpUh6b"
            />
          </div>
          <div className="flex justify-end gap-3 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
