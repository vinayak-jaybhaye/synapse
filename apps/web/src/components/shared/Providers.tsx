"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { normalizeError } from "../../lib/api";
import { useUIStore } from "../../store/ui-store";
import Toast from "./Toast";
import { useGateway } from "../../features/realtime/useGateway";

function GatewayListener() {
  useGateway();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error) => {
            const { message } = normalizeError(error);
            useUIStore.getState().showToast(message, "error");
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
            retry: 1,
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
      <GatewayListener />
      <Toast />
      {children}
    </QueryClientProvider>
  );
}
