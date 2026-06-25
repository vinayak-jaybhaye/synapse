"use client";

import React from "react";
import { useUIStore, ThemeType, FontSize, FontFamily, MessageDensity } from "../../../store/ui-store";

export default function AppearanceTab() {
  const { theme, setTheme, fontSize, setFontSize, fontFamily, setFontFamily, messageDensity, setMessageDensity } =
    useUIStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-primary">Appearance</h3>
        <p className="text-xs text-text-muted mt-1">Customize themes, sizing and densities.</p>
      </div>

      {/* Themes Grid */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary">Theme</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["dark", "light", "midnight", "oled"] as ThemeType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`border p-3.5 rounded-xl text-xs font-semibold text-center capitalize transition-colors cursor-pointer ${
                theme === t
                  ? "border-indigo-500 bg-indigo-500/10 text-text-primary"
                  : "border-border-custom bg-bg-secondary text-text-secondary hover:border-text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary">Font Size</label>
        <div className="grid grid-cols-3 gap-3">
          {(["compact", "normal", "large"] as FontSize[]).map((sz) => (
            <button
              key={sz}
              onClick={() => setFontSize(sz)}
              className={`border p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                fontSize === sz
                  ? "border-indigo-500 bg-indigo-500/10 text-text-primary"
                  : "border-border-custom bg-bg-secondary text-text-secondary hover:border-text-muted"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary">Font Family</label>
        <div className="grid grid-cols-3 gap-3">
          {(["inter", "geist", "system-ui"] as FontFamily[]).map((fam) => (
            <button
              key={fam}
              onClick={() => setFontFamily(fam)}
              className={`border p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                fontFamily === fam
                  ? "border-indigo-500 bg-indigo-500/10 text-text-primary"
                  : "border-border-custom bg-bg-secondary text-text-secondary hover:border-text-muted"
              }`}
            >
              {fam === "system-ui" ? "System UI" : fam}
            </button>
          ))}
        </div>
      </div>

      {/* Message Density */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary">Message Density</label>
        <div className="grid grid-cols-2 gap-3">
          {(["compact", "comfortable"] as MessageDensity[]).map((den) => (
            <button
              key={den}
              onClick={() => setMessageDensity(den)}
              className={`border p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                messageDensity === den
                  ? "border-indigo-500 bg-indigo-500/10 text-text-primary"
                  : "border-border-custom bg-bg-secondary text-text-secondary hover:border-text-muted"
              }`}
            >
              {den}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
