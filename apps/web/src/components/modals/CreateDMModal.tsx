import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { useDMs } from "../../services/query/useDMs";
import { useChannelStore } from "../../store/channel-store";

interface CreateDMModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateDMModal({ open, onClose }: CreateDMModalProps) {
  const [recipientId, setRecipientId] = useState("");
  const [error, setError] = useState("");
  const { createDM } = useDMs();
  const { selectChannel } = useChannelStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRecipientId("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim()) {
      setError("User ID is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      // Call create DM endpoint
      const newDM = await createDM(recipientId);

      // Auto-select the new DM
      if (newDM && newDM.channel_id) {
        selectChannel(newDM.channel_id);
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create DM");
    } finally {
      setIsSubmitting(false);
    }
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Enter the User ID of the person you want to message.
          </p>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">
              User ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="e.g. 1759284759392"
                className="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border-custom rounded focus:outline-none focus:border-indigo-500 text-text-primary placeholder:text-text-muted"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:underline text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !recipientId.trim()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Start Conversation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
