"use client";

import { create } from "zustand";

interface MessageRegistryState {
  // A map of message ID to its DOM element
  elements: Map<string, HTMLElement>;
  
  // Register a message element when it mounts
  register: (id: string, element: HTMLElement) => void;
  
  // Unregister a message element when it unmounts
  unregister: (id: string) => void;
  
  // Imperatively get a message element
  getElement: (id: string) => HTMLElement | undefined;

  // The ID of the currently highlighted message, used to trigger the CSS animation
  highlightedMessageId: string | null;
  
  // Action to trigger a jump and highlight
  scrollToMessage: (id: string) => void;
}

export const useMessageRegistry = create<MessageRegistryState>((set, get) => ({
  elements: new Map(),

  register: (id, element) => {
    get().elements.set(id, element);
  },

  unregister: (id) => {
    get().elements.delete(id);
  },

  getElement: (id) => {
    return get().elements.get(id);
  },

  highlightedMessageId: null,

  scrollToMessage: (id) => {
    const element = get().getElement(id);
    if (!element) {
      console.warn(`Message with ID ${id} not found in registry.`);
      return;
    }

    // Scroll into view smoothly.
    // In a virtualized list, this would interact with the virtualization engine instead.
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Trigger the highlight animation by updating the state
    set({ highlightedMessageId: id });

    // Clear the highlight after animation completes (2s)
    setTimeout(() => {
      // Only clear if it hasn't been overwritten by another jump
      if (get().highlightedMessageId === id) {
        set({ highlightedMessageId: null });
      }
    }, 2000);
  },
}));
