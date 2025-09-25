"use client";

import { useState } from "react";
import clsx from "clsx";

type CharsetId = "dense" | "blocks" | "minimal";
type ColorSchemeId = "matrix" | "amber" | "mono" | "cyber";
type ExportFormat = "gif" | "mp4" | "mov";

interface MobileControlsProps {
  // Character settings
  charsetId: CharsetId;
  setCharsetId: (id: CharsetId) => void;
  characterPresets: readonly { readonly label: string; readonly value: CharsetId; readonly charset: string }[];

  // Visual settings
  charPixelSize: number;
  setCharPixelSize: (size: number) => void;
  charPixelLimits: { min: number; max: number };
  contrast: number;
  setContrast: (contrast: number) => void;
  colorScheme: ColorSchemeId;
  setColorScheme: (scheme: ColorSchemeId) => void;
  colorSchemes: readonly { readonly label: string; readonly value: ColorSchemeId; readonly foreground: string; readonly accent: string }[];

  // File handling
  selectedFile: File | null;
  onUploadClick: () => void;

  // Export
  exportFormats: readonly ExportFormat[];
  onExport: (format: ExportFormat) => void;
  canExport: boolean;

  // Playback
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  // UI state
  chosenScheme: { accent: string; foreground: string };
  isLocked: boolean;
}

export function MobileControls({
  charsetId,
  setCharsetId,
  characterPresets,
  charPixelSize,
  setCharPixelSize,
  charPixelLimits,
  contrast,
  setContrast,
  colorScheme,
  setColorScheme,
  colorSchemes,
  selectedFile,
  onUploadClick,
  exportFormats,
  onExport,
  canExport,
  isPlaying,
  setIsPlaying,
  chosenScheme,
  isLocked,
}: MobileControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"style" | "video" | "export">("style");

  const toggleExpanded = () => {
    if (isLocked) return;
    setIsExpanded(!isExpanded);
  };

  const handleTabChange = (tab: "style" | "video" | "export") => {
    if (isLocked) return;
    setActiveTab(tab);
    if (!isExpanded) setIsExpanded(true);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-dim/60 backdrop-blur-sm z-50">
      {/* Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs uppercase tracking-wider text-accent">ASCII Controls</span>
        </div>
        <div className="flex items-center gap-3">
          {isLocked && (
            <span className="text-xs text-dim">🔒 Auth Required</span>
          )}
          <div
            className={clsx(
              "w-4 h-4 flex items-center justify-center transition-transform",
              isExpanded && "rotate-180"
            )}
          >
            <span className="text-xs">▲</span>
          </div>
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="border-t border-dim/60 bg-black/95">
          {/* Tab Navigation */}
          <div className="flex border-b border-dim/40">
            {[
              { id: "style", label: "Style" },
              { id: "video", label: "Video" },
              { id: "export", label: "Export" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as "style" | "video" | "export")}
                disabled={isLocked}
                className={clsx(
                  "flex-1 py-3 px-4 text-xs uppercase tracking-wider transition-colors",
                  activeTab === tab.id
                    ? "text-accent border-b-2 border-accent bg-accent/10"
                    : "text-dim hover:text-foreground",
                  isLocked && "opacity-50 cursor-not-allowed"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 max-h-80 overflow-y-auto">
            {/* Style Tab */}
            {activeTab === "style" && (
              <div className="space-y-4">
                {/* Character Style */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-accent mb-2">Character Style</h3>
                  <div className="grid gap-2">
                    {characterPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setCharsetId(preset.value)}
                        disabled={isLocked}
                        className={clsx(
                          "flex items-center justify-between p-3 border border-dim/60 text-left transition-colors",
                          preset.value === charsetId && "border-accent bg-accent/10",
                          isLocked && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div>
                          <div className="text-xs font-medium">{preset.label}</div>
                          <div className="text-xs text-dim truncate">{preset.charset.slice(0, 20)}...</div>
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rounded-full border-2",
                          preset.value === charsetId ? "border-accent bg-accent" : "border-dim/60"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Character Size */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-accent mb-2">Character Size</h3>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={charPixelLimits.min}
                      max={charPixelLimits.max}
                      step={1}
                      value={charPixelSize}
                      onChange={(e) => setCharPixelSize(Number(e.target.value))}
                      disabled={isLocked}
                      className="w-full accent-color"
                      style={{ accentColor: chosenScheme.accent }}
                    />
                    <div className="flex justify-between text-xs text-dim">
                      <span>Smaller</span>
                      <span>{charPixelSize}px</span>
                      <span>Larger</span>
                    </div>
                  </div>
                </div>

                {/* Contrast */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-accent mb-2">Contrast</h3>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      disabled={isLocked}
                      className="w-full"
                      style={{ accentColor: chosenScheme.accent }}
                    />
                    <div className="flex justify-between text-xs text-dim">
                      <span>0.5x</span>
                      <span>{contrast.toFixed(2)}x</span>
                      <span>2.0x</span>
                    </div>
                  </div>
                </div>

                {/* Color Scheme */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-accent mb-2">Theme</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {colorSchemes.map((scheme) => (
                      <button
                        key={scheme.value}
                        onClick={() => setColorScheme(scheme.value)}
                        disabled={isLocked}
                        className={clsx(
                          "p-3 border border-dim/60 text-left transition-colors",
                          colorScheme === scheme.value && "border-accent bg-accent/10",
                          isLocked && "opacity-50 cursor-not-allowed"
                        )}
                        style={{ color: scheme.foreground }}
                      >
                        <div className="text-xs font-medium">{scheme.label}</div>
                        <div className="text-xs" style={{ color: scheme.accent }}>
                          {scheme.foreground}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Video Tab */}
            {activeTab === "video" && (
              <div className="space-y-4">
                {/* Upload Button */}
                <button
                  onClick={onUploadClick}
                  disabled={isLocked}
                  className={clsx(
                    "w-full p-4 border border-dim/60 uppercase tracking-wider text-sm transition-colors",
                    selectedFile
                      ? "bg-accent/20 border-accent text-accent"
                      : "hover:bg-accent/10",
                    isLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {selectedFile ? "Replace Video" : "Upload Video"}
                </button>

                {/* File Info */}
                {selectedFile && (
                  <div className="p-3 border border-dim/60 bg-black/40">
                    <div className="text-xs font-medium truncate">{selectedFile.name}</div>
                    <div className="text-xs text-dim">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                )}

                {/* Playback Controls */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-accent mb-2">Playback</h3>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={isLocked}
                    className={clsx(
                      "w-full p-3 border border-dim/60 uppercase tracking-wider text-sm",
                      isLocked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                  </button>
                </div>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === "export" && (
              <div className="space-y-4">
                <div className="text-xs text-dim mb-4">
                  {isLocked ? "Authentication required to export files" : "Choose export format:"}
                </div>

                <div className="grid gap-2">
                  {exportFormats.map((format) => (
                    <button
                      key={format}
                      onClick={() => onExport(format)}
                      disabled={!canExport || isLocked}
                      className={clsx(
                        "w-full p-4 border border-dim/60 uppercase tracking-wider text-sm transition-colors",
                        canExport && !isLocked
                          ? "hover:bg-accent/10 hover:border-accent"
                          : "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Export .{format.toUpperCase()}
                    </button>
                  ))}
                </div>

                {isLocked && (
                  <div className="mt-4 p-3 border border-dim/60 bg-black/40 text-xs text-dim">
                    Register or login to unlock video exports
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}