"use client";

import React, { useState } from "react";
import { useUIStore } from "../../store/ui-store";
import { Menu, Users, X } from "lucide-react";
import GuildList from "../guilds/GuildList";
import ChannelSidebar from "../channels/ChannelSidebar";
import ChatArea from "../chat/ChatArea";
import MembersSidebar from "../members/MembersSidebar";
import VoiceFloatingOverlay from "../voice/VoiceFloatingOverlay";


export default function SidebarLayout() {
  const {
    channelSidebarCollapsed,
    setChannelSidebarCollapsed,
    membersSidebarCollapsed,
    setMembersSidebarCollapsed,
    channelSidebarWidth,
    setChannelSidebarWidth,
    membersSidebarWidth,
    setMembersSidebarWidth,
  } = useUIStore();

  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);

  const startResizingChannels = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = channelSidebarWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(400, startWidth + deltaX));
      setChannelSidebarWidth(newWidth);
    };

    const stopDrag = () => {
      window.removeEventListener("mousemove", doDrag);
      window.removeEventListener("mouseup", stopDrag);
    };

    window.addEventListener("mousemove", doDrag);
    window.addEventListener("mouseup", stopDrag);
  };

  const startResizingMembers = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = membersSidebarWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX; // drag left to increase
      const newWidth = Math.max(180, Math.min(350, startWidth + deltaX));
      setMembersSidebarWidth(newWidth);
    };

    const stopDrag = () => {
      window.removeEventListener("mousemove", doDrag);
      window.removeEventListener("mouseup", stopDrag);
    };

    window.addEventListener("mousemove", doDrag);
    window.addEventListener("mouseup", stopDrag);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary select-none font-sans">
      {/* 1. Guilds Navigation Sidebar (Always visible on desktop, moved to drawer on mobile) */}
      <div className="hidden md:flex w-[72px] shrink-0 bg-bg-tertiary border-r border-border-custom flex-col items-center py-3 space-y-2 z-20">
        <GuildList />
      </div>

      {/* 2. Desktop Channel Sidebar (Collapsible & Resizable) */}
      {!channelSidebarCollapsed && (
        <div
          style={{ width: `${channelSidebarWidth}px` }}
          className="hidden md:flex flex-col shrink-0 bg-bg-secondary border-r border-border-custom relative h-full group"
        >
          <ChannelSidebar />
          
          {/* Resize Handle */}
          <div
            onMouseDown={startResizingChannels}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500 transition-colors z-30"
          />
        </div>
      )}

      {/* 3. Primary Viewport Area (Header + Main Chat Pane) */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-primary relative h-full">
        {/* Responsive Mobile Header Triggers */}
        <div className="md:hidden h-12 shrink-0 bg-bg-secondary border-b border-border-custom flex items-center justify-between px-3 z-10 shadow-sm">
          <button
            onClick={() => setMobileChannelsOpen(true)}
            className="p-1.5 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
            aria-label="Toggle channels sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <span className="font-bold text-text-primary">Synapse</span>

          <button
            onClick={() => setMobileMembersOpen(true)}
            className="p-1.5 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
            aria-label="Toggle members sidebar"
          >
            <Users className="h-5 w-5" />
          </button>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 h-full relative">
          <ChatArea />
        </div>
      </div>

      {/* 4. Desktop Members Sidebar (Collapsible & Resizable) */}
      {!membersSidebarCollapsed && (
        <div
          style={{ width: `${membersSidebarWidth}px` }}
          className="hidden lg:flex flex-col shrink-0 bg-bg-secondary border-l border-border-custom relative h-full"
        >
          {/* Resize Handle */}
          <div
            onMouseDown={startResizingMembers}
            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500 transition-colors z-30"
          />
          <MembersSidebar />
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE DRAWER: Channels Sidebar Overlay */}
      {/* ============================================================== */}
      {mobileChannelsOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setMobileChannelsOpen(false)}
          />
          {/* Content */}
          <div className="relative flex w-[85vw] max-w-[340px] bg-bg-secondary h-full shadow-xl">
            {/* Guild List inside mobile drawer */}
            <div className="w-[72px] shrink-0 bg-bg-tertiary border-r border-border-custom flex flex-col items-center py-3 space-y-2">
              <GuildList />
            </div>
            {/* Channel Sidebar inside mobile drawer */}
            <div className="flex-1 min-w-0 h-full flex flex-col relative">
              <ChannelSidebar />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE DRAWER: Members Sidebar Overlay */}
      {/* ============================================================== */}
      {mobileMembersOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setMobileMembersOpen(false)}
          />
          {/* Content */}
          <div className="relative flex flex-col w-[85vw] max-w-[340px] bg-bg-secondary h-full shadow-xl">
            <div className="flex-1 overflow-y-auto">
              <MembersSidebar />
            </div>
          </div>
        </div>
      )}
      <VoiceFloatingOverlay />
    </div>
  );
}
