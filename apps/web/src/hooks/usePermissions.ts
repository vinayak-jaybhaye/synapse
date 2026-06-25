import { useMemo } from "react";
import { PermissionFlags, hasPermission } from "../types";

export function useChannelPermissions(permissions?: string, isDM?: boolean) {
  return useMemo(() => {
    if (isDM) {
      return {
        canViewChannel: true,
        canSendMessages: true,
        canAttachFiles: true,
        canAddReactions: true,
        canManageMessages: false,
        canManageChannels: false,
        canEmbedLinks: true,
        canMentionEveryone: true,
        canUseExternalEmojis: true,
        canUseExternalStickers: true,
        canConnect: true,
        canSpeak: true,
        canMuteMembers: false,
        canDeafenMembers: false,
        canMoveMembers: false,
        canCreateInstantInvite: false,
      };
    }
    return {
      canViewChannel: hasPermission(permissions, PermissionFlags.VIEW_CHANNEL),
      canSendMessages: hasPermission(permissions, PermissionFlags.SEND_MESSAGES),
      canAttachFiles: hasPermission(permissions, PermissionFlags.ATTACH_FILES),
      canAddReactions: hasPermission(permissions, PermissionFlags.ADD_REACTIONS),
      canManageMessages: hasPermission(permissions, PermissionFlags.MANAGE_MESSAGES),
      canManageChannels: hasPermission(permissions, PermissionFlags.MANAGE_CHANNELS),
      canEmbedLinks: hasPermission(permissions, PermissionFlags.EMBED_LINKS),
      canMentionEveryone: hasPermission(permissions, PermissionFlags.MENTION_EVERYONE),
      // External emojis/stickers (future use - mapped to some flag or assumed true if sending messages)
      // For now, mapping to SEND_MESSAGES or a specific external flag if available
      canUseExternalEmojis: hasPermission(permissions, PermissionFlags.SEND_MESSAGES), 
      canUseExternalStickers: hasPermission(permissions, PermissionFlags.SEND_MESSAGES),
      canConnect: hasPermission(permissions, PermissionFlags.CONNECT),
      canSpeak: hasPermission(permissions, PermissionFlags.SPEAK),
      canMuteMembers: hasPermission(permissions, PermissionFlags.MUTE_MEMBERS),
      canDeafenMembers: hasPermission(permissions, PermissionFlags.DEAFEN_MEMBERS),
      canMoveMembers: hasPermission(permissions, PermissionFlags.MOVE_MEMBERS),
      canCreateInstantInvite: hasPermission(permissions, PermissionFlags.CREATE_INSTANT_INVITE),
    };
  }, [permissions, isDM]);
}

export function useGuildPermissions(permissions?: string) {
  return useMemo(() => {
    return {
      canManageGuild: hasPermission(permissions, PermissionFlags.MANAGE_GUILD),
      canManageRoles: hasPermission(permissions, PermissionFlags.MANAGE_ROLES),
      canManageChannels: hasPermission(permissions, PermissionFlags.MANAGE_CHANNELS),
      
      canKickMembers: hasPermission(permissions, PermissionFlags.KICK_MEMBERS),
      canBanMembers: hasPermission(permissions, PermissionFlags.BAN_MEMBERS),
      canCreateInstantInvite: hasPermission(permissions, PermissionFlags.CREATE_INSTANT_INVITE),
    };
  }, [permissions]);
}
