"use client";

import React from "react";

export default function AccessibilityTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary">Accessibility Settings</h3>
        <p className="text-xs text-text-muted mt-1">Configure options for high contrast or focus indicators.</p>
      </div>

      <div className="bg-bg-secondary border border-border-custom rounded-2xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-text-primary">Keyboard Navigation Guide</h4>
        <p className="text-xs text-text-muted leading-relaxed">
          Synapse fully supports keyboard pagination and layout manipulation. Press{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom">Tab</code> to cycle
          interactive actions, and use{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom">Enter</code> or{" "}
          <code className="bg-bg-tertiary px-1 py-0.5 rounded border border-border-custom">Space</code> to trigger.
        </p>
      </div>
    </div>
  );
}
