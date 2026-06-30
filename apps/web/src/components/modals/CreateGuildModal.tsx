"use client";

import React, { useState } from "react";

interface CreateGuildModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: { name: string; description?: string }) => Promise<any>;
}

export default function CreateGuildModal({ open, onClose, onCreate }: CreateGuildModalProps) {
  const [guildName, setGuildName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!guildName.trim()) return;

    try {
      await onCreate({ name: guildName.trim() });
      setGuildName("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create guild");
    }
  };

  const handleClose = () => {
    setError(null);
    setGuildName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-md bg-bg-secondary border border-border-custom rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Create a Guild</h3>
          <p className="text-text-muted text-xs mt-1">
            Your guild is where you and your friends hang out. Make yours and start chatting!
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
              Guild Name
            </label>
            <input
              type="text"
              required
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              className="w-full bg-bg-primary border border-border-custom focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-all"
              placeholder="e.g. My Awesome Club"
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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
