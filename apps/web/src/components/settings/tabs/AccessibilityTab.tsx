"use client";

import React from "react";
import { Accessibility } from "lucide-react";

export default function AccessibilityTab() {
  return (
    <div className="space-y-4">
      <div className="border-b border-border-custom pb-3">
        <div className="flex items-center gap-1.5">
          <Accessibility className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Accessibility</h3>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">
          Configure options for keyboard navigation and screen layout behaviors.
        </p>
      </div>

      <div className="bg-bg-secondary rounded p-3 space-y-2">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
          Keyboard Navigation Guide
        </h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          Synapse fully supports keyboard focus cycling and panel actions. Press{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom text-[10px] font-mono">
            Tab
          </code>{" "}
          to cycle through interactive elements, and use{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom text-[10px] font-mono">
            Enter
          </code>{" "}
          or{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom text-[10px] font-mono">
            Space
          </code>{" "}
          to trigger actions.
        </p>
      </div>
    </div>
  );
}
