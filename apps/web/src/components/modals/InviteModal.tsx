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
      setError(err.message || "Failed to generate invite link");
    }
  };

  const handleCopy = () => {
    if (!inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : "";

  return (
    <Dialog.Root open={showInviteModal} onOpenChange={setShowInviteModal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[440px] bg-bg-primary rounded-xl shadow-2xl z-50 animate-scale-in border border-border-color overflow-hidden flex flex-col">
          <div className="p-4 flex justify-between items-center bg-bg-secondary border-b border-border-color">
            <Dialog.Title className="text-xl font-bold text-text-primary">
              Invite friends to {activeGuild?.name || "Server"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-text-muted hover:text-text-primary transition-colors outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded text-sm text-center">
                {error}
              </div>
            )}

            <p className="text-sm text-text-secondary mb-2 font-medium">
              Share this link with others to grant access to your server!
            </p>

            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary select-all truncate outline-none">
                {isCreating ? "Generating..." : inviteUrl || "..."}
              </div>
              <button
                onClick={handleCopy}
                disabled={!inviteCode || isCreating}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded flex items-center justify-center font-medium transition-colors outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            
            <p className="text-xs text-text-muted mt-3">
              Your invite link will expire in 7 days.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
