/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { useDMs } from "../../services/query/useDMs";
import { useChannelStore } from "../../store/channel-store";
import { useGuildStore } from "../../store/guild-store";
import { normalizeError } from "../../lib/api";
import { usersApi } from "../../services/api/users";
import { UserSummary } from "../../types";
import { getMediaUrl } from "../../lib/media";

interface CreateDMModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateDMModal({ open, onClose }: CreateDMModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const { dms } = useDMs();
  const { selectChannel } = useChannelStore();
  const { selectGuild } = useGuildStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery("");
      setSearchResults([]);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const results = await usersApi.search(searchQuery.trim());
          setSearchResults(results || []);
        } catch (err: unknown) {
          console.error("Search failed:", err);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  if (!open) return null;

  const handleCreateDM = async (userId: string) => {
    if (!userId.trim()) return;

    try {
      setIsSubmitting(true);
      setError("");
      const existingDM = dms?.find((d) => d.recipient.id === userId);
      selectGuild(null);
      if (existingDM) {
        selectChannel(existingDM.channel_id);
      } else {
        selectChannel(`pending-dm-${userId}`);
      }

      onClose();
    } catch (err: unknown) {
      setError(normalizeError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setError("User ID or username is required.");
      return;
    }
    // If they just hit enter, try to create with the exact query text
    handleCreateDM(searchQuery.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 font-sans">
      <div
        className="w-full max-w-[440px] bg-bg-primary rounded-xl shadow-2xl flex flex-col mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-border-custom">
          <h2 className="text-xl font-bold text-text-primary">New Direct Message</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col min-h-[300px]">
          <p className="text-sm text-text-secondary mb-4">
            Search for a user by username or ID to start a conversation.
          </p>

          <div className="flex-none">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or ID..."
                className="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border-custom rounded focus:outline-none focus:border-indigo-500 text-text-primary placeholder:text-text-muted"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin" />
              )}
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-1">
            {searchResults.length > 0 ? (
              searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleCreateDM(user.id)}
                  disabled={isSubmitting}
                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-bg-secondary transition-colors text-left disabled:opacity-50"
                >
                  {user.avatar_key ? (
                    <img
                      src={getMediaUrl(user.avatar_key)}
                      alt={user.username}
                      className="h-10 w-10 rounded-full object-cover flex-none"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center flex-none">
                      <span className="text-white text-sm font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium truncate">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-text-secondary text-xs truncate">@{user.username}</p>
                  </div>
                </button>
              ))
            ) : searchQuery.trim() && !isSearching ? (
              <div className="text-center text-text-muted text-sm py-8">
                No users found matching &quot;{searchQuery}&quot;
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
