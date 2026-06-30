"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUIStore } from "../../store/ui-store";
import Toast from "./Toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const theme = useUIStore((s) => s.theme);
  const fontSize = useUIStore((s) => s.fontSize);
  const fontFamily = useUIStore((s) => s.fontFamily);
  const messageDensity = useUIStore((s) => s.messageDensity);

  useEffect(() => {
    const root = document.documentElement;
    const classesToRemove = Array.from(root.classList).filter(
      (c) =>
        c.startsWith("theme-") ||
        c.startsWith("font-size-") ||
        c.startsWith("font-family-") ||
        c.startsWith("density-"),
    );
    root.classList.remove(...classesToRemove);

    root.classList.add(`theme-${theme}`);
    root.classList.add(`font-size-${fontSize}`);
    root.classList.add(`font-family-${fontFamily}`);
    root.classList.add(`density-${messageDensity}`);
  }, [theme, fontSize, fontFamily, messageDensity]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toast />
      {children}
    </QueryClientProvider>
  );
}
