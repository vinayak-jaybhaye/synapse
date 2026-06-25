"use client";

import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store";

export default function AuthInitializer() {
  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  return null;
}
