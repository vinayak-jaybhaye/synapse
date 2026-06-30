"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X, Check } from "lucide-react";
import { useUIStore } from "../../store/ui-store";
import { useGuildStore } from "../../store/guild-store";
import { useCreateInvite } from "../../services/query/useInvites";
import { useGuilds } from "../../services/query/useGuilds";

export default function InviteModal() {
  const { showInviteModal, setShowInviteModal } = useUIStore();
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  const { createInvite, isCreating } = useCreateInvite();

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeGuild = guilds.find((g) => g.id === activeGuildId);

  // Generate invite code when modal opens
  React.useEffect(() => {
    if (showInviteModal && activeGuildId && !inviteCode) {
      handleGenerateInvite();
    }
    if (!showInviteModal) {
      // reset state on close
      setInviteCode(null);
      setCopied(false);
      setError(null);
    }
  }, [showInviteModal, activeGuildId]);

  const handleGenerateInvite = async () => {
    if (!activeGuildId) return;
    try {
      setError(null);
      const res = await createInvite({ guildId: activeGuildId });
      setInviteCode(res.code);
    } catch (err: any) {
      setError(err.message || "Failed to generate invite code");
    }
  };

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open={showInviteModal} onOpenChange={setShowInviteModal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[380px] bg-bg-primary rounded-md shadow-lg z-50 border border-border-custom overflow-hidden flex flex-col font-sans select-none">
          <div className="p-3 flex justify-between items-center bg-bg-secondary border-b border-border-custom">
            <Dialog.Title className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Invite to {activeGuild?.name || "Server"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded p-0.5 hover:bg-bg-tertiary">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 space-y-3.5">
            {error && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded text-xs text-center font-medium">
                {error}
              </div>
            )}

            <p className="text-xs text-text-secondary leading-relaxed">
              Share this invite code with others to grant access to your server!
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary font-mono select-all truncate outline-none">
                {isCreating ? "Generating..." : inviteCode || "..."}
              </div>
              <button
                onClick={handleCopy}
                disabled={!inviteCode || isCreating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="ml-1.5">{copied ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            <p className="text-[10px] text-text-muted">Your invite code will expire in 7 days.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
