"use client";

import React, { useEffect, useState } from "react";
import { Info, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useUIStore } from "../../store/ui-store";

export default function Toast() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for slide-out animation to complete before clearing state
        setTimeout(hideToast, 300);
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-indigo-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case "error":
        return "border-l-red-500";
      case "success":
        return "border-l-emerald-500";
      case "info":
      default:
        return "border-l-indigo-500";
    }
  };

  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border border-border-custom bg-bg-secondary/90 backdrop-blur-md min-w-[280px] max-w-md border-l-4 ${getBorderColor()} transition-all duration-300 transform ${
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
      }`}
      role="alert"
    >
      {getIcon()}
      <span className="text-sm font-medium text-text-primary flex-1 leading-snug">
        {toast.message}
      </span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(hideToast, 300);
        }}
        className="text-text-secondary hover:text-text-primary p-0.5 rounded hover:bg-bg-tertiary transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
