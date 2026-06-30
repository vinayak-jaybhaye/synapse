"use client";

import React, { useState } from "react";
import { useChannelStore } from "../../store/channel-store";

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: { name: string; type: number; topic?: string }) => Promise<any>;
}

export default function CreateChannelModal({ open, onClose, onCreate }: CreateChannelModalProps) {
  const { selectChannel } = useChannelStore();
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!channelName.trim()) return;

    try {
      const newChan = await onCreate({
        name: channelName.trim(),
        type: channelType,
      });
      setChannelName("");
      onClose();

      // Auto select the new text channel
      if (channelType === 0 && newChan?.id) {
        selectChannel(newChan.id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create channel");
    }
  };

  const handleClose = () => {
    setError(null);
    setChannelName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-md bg-bg-secondary border border-border-custom rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Create Channel</h3>
          <p className="text-text-muted text-xs mt-1">Add a new workspace channel in the guild.</p>
        </div>
        {error && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Channel Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-text-primary">
                <input
                  type="radio"
                  name="channel_type"
                  checked={channelType === 0}
                  onChange={() => setChannelType(0)}
                />
                Text (#)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-text-primary">
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
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Channel Name
            </label>
            <input
              type="text"
              required
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full bg-bg-primary border border-border-custom focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-all"
              placeholder="e.g. dev-chat"
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
