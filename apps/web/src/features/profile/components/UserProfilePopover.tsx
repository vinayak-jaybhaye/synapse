import React, { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import UserProfileCard from "./UserProfileCard";
import { useUserProfile } from "../api/use-profile";

interface UserProfilePopoverProps {
  userId: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export default function UserProfilePopover({
  userId,
  children,
  side = "right",
  align = "start",
}: UserProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Only fetch profile when popover is opened
  const { data: profile, isLoading } = useUserProfile(userId, isOpen);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side={isMobile ? "bottom" : side}
          align={isMobile ? "center" : align}
          sideOffset={8}
          className="z-50 outline-none radix-state-open:animate-in radix-state-closed:animate-out radix-state-closed:fade-out-0 radix-state-open:fade-in-0 radix-state-closed:zoom-out-95 radix-state-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          collisionPadding={isMobile ? 16 : 10}
        >
          {isLoading || !profile ? (
            <UserProfileCard profile={null} isLoading={true} />
          ) : (
            <UserProfileCard profile={profile} onClose={() => setIsOpen(false)} />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
