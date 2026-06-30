"use client";

import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../store/auth-store";
import { useGuildStore } from "../store/guild-store";
import { useUIStore } from "../store/ui-store";
import { useGuilds } from "../services/query/useGuilds";
import { useChannels } from "../services/query/useChannels";
import SidebarLayout from "../components/layout/SidebarLayout";
import UserSettingsModal from "../components/settings/UserSettingsModal";
import GuildSettingsModal from "../components/settings/GuildSettingsModal";
import ChannelSettingsModal from "../components/settings/ChannelSettingsModal";
import LandingPage from "../components/landing/LandingPage";
import CreateGuildModal from "../components/modals/CreateGuildModal";
import JoinGuildModal from "../components/modals/JoinGuildModal";
import CreateChannelModal from "../components/modals/CreateChannelModal";
import CreateDMModal from "../components/modals/CreateDMModal";
import InviteModal from "../components/modals/InviteModal";

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { activeGuildId } = useGuildStore();

  const {
    showCreateGuild,
    setShowCreateGuild,
    showJoinGuild,
    setShowJoinGuild,
    showCreateChannel,
    setShowCreateChannel,
    showCreateDM,
    setShowCreateDM,
    showSettings,
    showGuildSettings,
    showChannelSettings,
  } = useUIStore();

  const { createGuild, joinGuild } = useGuilds();
  const { createChannel } = useChannels(activeGuildId || undefined);

  // Close modals on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateGuild(false);
        setShowJoinGuild(false);
        setShowCreateChannel(false);
        setShowCreateDM(false);
        useUIStore.getState().setShowInviteModal(false);
        useUIStore.getState().setShowChannelSettings(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowCreateGuild, setShowJoinGuild, setShowCreateChannel, setShowCreateDM]);

  // Loading state
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Unauthenticated → Landing Page
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Authenticated → App Shell
  return (
    <>
      <SidebarLayout />

      <CreateGuildModal
        open={showCreateGuild}
        onClose={() => setShowCreateGuild(false)}
        onCreate={createGuild}
      />

      <JoinGuildModal
        open={showJoinGuild}
        onClose={() => setShowJoinGuild(false)}
        onJoin={joinGuild}
      />

      <CreateChannelModal
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreate={createChannel}
      />

      <CreateDMModal open={showCreateDM} onClose={() => setShowCreateDM(false)} />

      <InviteModal />

      {showSettings && <UserSettingsModal />}
      {showGuildSettings && <GuildSettingsModal />}
      {showChannelSettings && <ChannelSettingsModal />}
    </>
  );
}
