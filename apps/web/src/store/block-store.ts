import { create } from "zustand";

interface BlockState {
  blockedUserIds: Set<string>;
  setBlockedUserIds: (ids: string[]) => void;
  addBlockedUser: (id: string) => void;
  removeBlockedUser: (id: string) => void;
  isBlocked: (id: string) => boolean;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedUserIds: new Set<string>(),
  setBlockedUserIds: (ids: string[]) => {
    set({ blockedUserIds: new Set(ids) });
  },
  addBlockedUser: (id: string) => {
    const newSet = new Set(get().blockedUserIds);
    newSet.add(id);
    set({ blockedUserIds: newSet });
  },
  removeBlockedUser: (id: string) => {
    const newSet = new Set(get().blockedUserIds);
    newSet.delete(id);
    set({ blockedUserIds: newSet });
  },
  isBlocked: (id: string) => {
    return get().blockedUserIds.has(id);
  },
}));
