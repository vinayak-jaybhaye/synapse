"use client";

import React from "react";
import {
  useUIStore,
  ThemeType,
  FontSize,
  FontFamily,
  MessageDensity,
} from "../../../store/ui-store";
import { Type, AlignJustify, Eye } from "lucide-react";

export default function AppearanceTab() {
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    messageDensity,
    setMessageDensity,
  } = useUIStore();

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="border-b border-border-custom pb-3">
        <div className="flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Appearance</h3>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">
          Customize themes, sizing, and densities to match your setup.
        </p>
      </div>

      {/* Theme Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Themes
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(["dark", "light", "midnight", "oled"] as ThemeType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`group flex flex-col gap-1.5 border p-2 rounded transition-all duration-150 cursor-pointer ${
                theme === t
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-border-custom bg-bg-secondary hover:border-text-muted"
              }`}
            >
              {/* Theme Mini Preview Visual */}
              <div
                className={`h-12 w-full rounded border border-border-custom/30 flex flex-col p-2 gap-1 justify-center ${
                  t === "dark"
                    ? "bg-[#2b2d31]"
                    : t === "light"
                      ? "bg-white"
                      : t === "midnight"
                        ? "bg-[#0d0e12]"
                        : "bg-black"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-3 w-3 rounded ${t === "light" ? "bg-gray-300" : "bg-gray-700"}`}
                  />
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div
                      className={`h-1 rounded w-9/12 ${
                        t === "light" ? "bg-gray-400" : "bg-gray-600"
                      }`}
                    />
                    <div
                      className={`h-0.5 rounded w-5/12 ${
                        t === "light" ? "bg-gray-300" : "bg-gray-800"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Title & Radio Dot */}
              <div className="flex items-center justify-between px-0.5 mt-0.5 select-none">
                <span className="text-xs font-semibold capitalize text-text-primary">{t}</span>
                <div
                  className={`h-3 w-3 rounded-full border flex items-center justify-center transition-colors ${
                    theme === t
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-border-custom bg-bg-primary"
                  }`}
                >
                  {theme === t && <div className="h-1 w-1 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Typography settings panel group */}
      <div className="bg-bg-secondary rounded p-3 space-y-4">
        {/* Font Family Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Type className="h-3.5 w-3.5 text-text-secondary" />
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Font Family
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["inter", "geist", "system-ui"] as FontFamily[]).map((fam) => (
              <button
                key={fam}
                onClick={() => setFontFamily(fam)}
                className={`border px-2.5 py-1.5 rounded text-xs font-medium capitalize text-center transition-all duration-150 cursor-pointer ${
                  fontFamily === fam
                    ? "border-indigo-500 bg-indigo-500/5 text-text-primary font-bold"
                    : "border-border-custom bg-bg-primary text-text-secondary hover:border-text-muted hover:text-text-primary"
                }`}
                style={{
                  fontFamily:
                    fam === "inter"
                      ? "var(--font-inter, sans-serif)"
                      : fam === "geist"
                        ? "var(--font-geist, sans-serif)"
                        : "system-ui, sans-serif",
                }}
              >
                {fam === "system-ui" ? "System UI" : fam}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Type className="h-3.5 w-3.5 text-text-secondary" />
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Font Size
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["compact", "normal", "large"] as FontSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => setFontSize(sz)}
                className={`border px-2.5 py-1.5 rounded text-xs font-medium capitalize transition-all duration-150 cursor-pointer ${
                  fontSize === sz
                    ? "border-indigo-500 bg-indigo-500/5 text-text-primary font-bold"
                    : "border-border-custom bg-bg-primary text-text-secondary hover:border-text-muted hover:text-text-primary"
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* Message Density Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <AlignJustify className="h-3.5 w-3.5 text-text-secondary" />
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Message Density
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["compact", "comfortable"] as MessageDensity[]).map((den) => (
              <button
                key={den}
                onClick={() => setMessageDensity(den)}
                className={`border px-2.5 py-1.5 rounded text-xs font-medium capitalize transition-all duration-150 cursor-pointer ${
                  messageDensity === den
                    ? "border-indigo-500 bg-indigo-500/5 text-text-primary font-bold"
                    : "border-border-custom bg-bg-primary text-text-secondary hover:border-text-muted hover:text-text-primary"
                }`}
              >
                {den}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
