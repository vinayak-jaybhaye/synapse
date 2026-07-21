"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import GuildList from "../guilds/GuildList";
import ChannelSidebar from "../channels/ChannelSidebar";
import ChatArea from "../chat/ChatArea";
import MembersSidebar from "../members/MembersSidebar";
import VoiceFloatingOverlay from "../voice/VoiceFloatingOverlay";

export default function SidebarLayout() {
  const {
    channelSidebarCollapsed,
    membersSidebarCollapsed,
    setMembersSidebarCollapsed,
    channelSidebarWidth,
    setChannelSidebarWidth,
    membersSidebarWidth,
    setMembersSidebarWidth,
    mobileChannelsOpen,
    setMobileChannelsOpen,
    mobileMembersOpen,
    setMobileMembersOpen,
  } = useUIStore();

  const startResizingChannels = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = channelSidebarWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(240, Math.min(400, startWidth + deltaX));
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
      const targetWidth = startWidth + deltaX;

      if (targetWidth < 120) {
        setMembersSidebarCollapsed(true);
      } else {
        setMembersSidebarCollapsed(false);
        const newWidth = Math.max(180, Math.min(480, targetWidth));
        setMembersSidebarWidth(newWidth);
      }
    };

    const stopDrag = () => {
      window.removeEventListener("mousemove", doDrag);
      window.removeEventListener("mouseup", stopDrag);
    };

    window.addEventListener("mousemove", doDrag);
    window.addEventListener("mouseup", stopDrag);
  };

  const startResizingMembersCollapsed = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX; // drag left to increase width from 0
      if (deltaX > 40) {
        setMembersSidebarCollapsed(false);
        const newWidth = Math.max(180, Math.min(480, deltaX));
        setMembersSidebarWidth(newWidth);
      }
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
        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 h-full relative">
          <ChatArea />
        </div>
      </div>

      {/* 4. Desktop Members Sidebar (Collapsible & Resizable) */}
      {!membersSidebarCollapsed ? (
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
      ) : (
        /* Collapsed Handle Strip at the right screen edge */
        <div
          onMouseDown={startResizingMembersCollapsed}
          className="hidden lg:block absolute top-0 right-0 w-2.5 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 transition-colors z-30 opacity-70 hover:opacity-100"
          title="Drag left to show members list"
        />
      )}

      {/* ============================================================== */}
      {/* MOBILE DRAWER: Channels Sidebar Overlay */}
      {/* ============================================================== */}
      {mobileChannelsOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Content */}
          <div className="relative flex w-full bg-bg-secondary h-full shadow-xl">
            {/* Guild List inside mobile drawer */}
            <div className="w-[72px] shrink-0 bg-bg-tertiary border-r border-border-custom flex flex-col items-center py-3 space-y-2">
              <GuildList />
            </div>
            {/* Channel Sidebar inside mobile drawer */}
            <div className="flex-1 min-w-0 h-full flex flex-col relative">
              <ChannelSidebar onChannelClick={() => setMobileChannelsOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE DRAWER: Members Sidebar Overlay */}
      {/* ============================================================== */}
      {mobileMembersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setMobileMembersOpen(false)}
          />
          {/* Content */}
          <div className="relative flex flex-col w-full md:w-[320px] bg-bg-secondary h-full shadow-xl">
            <MembersSidebar onClose={() => setMobileMembersOpen(false)} />
          </div>
        </div>
      )}
      <VoiceFloatingOverlay />
    </div>
  );
}
