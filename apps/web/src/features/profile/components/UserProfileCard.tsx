import React from "react";
import { UserProfile } from "../../../types";
import { getMediaUrl } from "../../../lib/media";
import { formatTimestamp } from "../../../lib/utils";
import { MessageSquare } from "lucide-react";
import { useDMs } from "../../../services/query/useDMs";
import { useChannelStore } from "../../../store/channel-store";
import { useGuildStore } from "../../../store/guild-store";

interface UserProfileCardProps {
  profile: UserProfile;
  isLoading?: boolean;
  onClose?: () => void;
}

export default function UserProfileCard({ profile, isLoading, onClose }: UserProfileCardProps) {
  const { createDM } = useDMs();
  const { selectChannel } = useChannelStore();
  const { selectGuild } = useGuildStore();

  const handleMessage = async () => {
    if (!profile) return;
    try {
      const dm = await createDM(profile.id);
      if (dm && dm.channel_id) {
        selectGuild(null);
        selectChannel(dm.channel_id);
        if (onClose) onClose();
      }
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  };
  if (isLoading) {
    return (
      <div className="w-[300px] bg-[#111214] border border-[#1e1f22] rounded-lg overflow-hidden shadow-xl flex flex-col animate-pulse">
        <div className="h-24 bg-bg-tertiary" />
        <div className="px-4 pb-4">
          <div className="relative -mt-10 mb-3">
            <div className="w-20 h-20 rounded-full bg-border-color border-4 border-[#111214]" />
          </div>
          <div className="space-y-3">
            <div className="h-5 bg-border-color rounded w-1/2" />
            <div className="h-4 bg-border-color rounded w-1/3" />
            <div className="h-px bg-border-color w-full my-3" />
            <div className="h-4 bg-border-color rounded w-full" />
            <div className="h-4 bg-border-color rounded w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="w-[300px] bg-[#111214] border border-[#1e1f22] rounded-lg overflow-hidden shadow-xl flex flex-col text-text-primary">
      {/* Banner */}
      <div 
        className={`h-24 w-full ${!profile.banner_key ? 'bg-indigo-600' : ''}`}
        style={profile.banner_key ? { backgroundImage: `url(${getMediaUrl(profile.banner_key)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      />
      
      {/* Body */}
      <div className="px-4 pb-4">
        {/* Avatar positioned halfway over the banner */}
        <div className="relative -mt-10 mb-2 flex justify-between items-end">
          <div className="w-20 h-20 rounded-full border-4 border-[#111214] bg-indigo-500 flex items-center justify-center font-bold text-white text-2xl overflow-hidden shadow-sm relative">
            {profile.avatar_key ? (
              <img src={getMediaUrl(profile.avatar_key)} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              profile.username?.charAt(0).toUpperCase() || "?"
            )}
            {/* Status indicator could go here in the future */}
          </div>
        </div>

        {/* User Info */}
        <div className="mb-3">
          <h2 className="text-xl font-bold leading-tight">
            {profile.display_name || profile.username}
          </h2>
          <p className="text-sm text-text-muted">{profile.username}</p>
        </div>

        <div className="h-px bg-border-color w-full my-3" />

        {/* About Me / Bio */}
        {profile.bio && (
          <div className="mb-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">About Me</h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* Member Since */}
        <div className="mb-4">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Member Since</h3>
          <p className="text-sm text-text-secondary">{joinedDate}</p>
        </div>
        
        {/* Mutual Guilds (Future placeholder if we expand it) */}
        {profile.mutual_guilds !== undefined && profile.mutual_guilds > 0 && (
          <div className="mb-4">
            <p className="text-sm text-text-secondary">{profile.mutual_guilds} Mutual Server{profile.mutual_guilds !== 1 ? 's' : ''}</p>
          </div>
        )}

        <button
          onClick={handleMessage}
          className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm font-semibold transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </button>

      </div>
    </div>
  );
}
