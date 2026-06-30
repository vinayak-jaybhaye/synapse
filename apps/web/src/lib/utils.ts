import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a numeric role color to a hex string.
 * Returns a neutral gray when no color is set.
 */
export function getRoleColorHex(color?: number): string {
  if (!color) return "#94a3b8";
  return "#" + color.toString(16).padStart(6, "0");
}

/**
 * Extract initials from a name string.
 * @param name - The name to extract initials from
 * @param length - Number of characters (default: 2)
 */
export function getInitials(name: string, length = 2): string {
  return name.substring(0, length).toUpperCase();
}

/**
 * Format an ISO timestamp into a short time string (e.g. "2:30 PM").
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format an ISO timestamp into a relative or absolute date string.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
