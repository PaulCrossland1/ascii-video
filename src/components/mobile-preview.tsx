"use client";

import clsx from "clsx";

interface MobilePreviewProps {
  previewContent: { body: string; isHtml: boolean };
  chosenScheme: { foreground: string; accent: string };
  status: string;
  isFreeTier: boolean;
  frameMetrics: { width: number; height: number; charWidth: number; charHeight: number };
  contrast: number;
  charPixelSize: number;
}

export function MobilePreview({
  previewContent,
  chosenScheme,
  status,
  isFreeTier,
  frameMetrics,
  contrast,
  charPixelSize,
}: MobilePreviewProps) {
  // Mobile preview sizing - much smaller and compressed
  const MOBILE_TARGET_HEIGHT = 200; // Compressed height for mobile
  const mobileAspectRatio = 16 / 9; // Standard aspect ratio
  const mobileWidth = MOBILE_TARGET_HEIGHT * mobileAspectRatio;

  const mobileFontSize = Math.max(4, Math.min(8, Math.floor(MOBILE_TARGET_HEIGHT / Math.max(frameMetrics.height || 40, 40))));
  const mobileLineHeight = mobileFontSize * 1.1;

  const mobileTextStyle = {
    fontSize: `${mobileFontSize}px`,
    lineHeight: `${mobileLineHeight}px`,
    maxWidth: "100%",
    maxHeight: "100%",
  };

  const mobileContainerStyle = {
    width: `${mobileWidth}px`,
    height: `${MOBILE_TARGET_HEIGHT}px`,
  };

  return (
    <div className="w-full">
      {/* Compressed Preview */}
      <div className="flex justify-center mb-3">
        <div className="relative" style={mobileContainerStyle}>
          <div className="relative w-full h-full overflow-hidden rounded border border-dim/60 bg-black/90 shadow-lg">
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: chosenScheme.foreground }}
            >
              <div
                className="font-mono overflow-hidden w-full h-full flex items-center justify-center"
                style={mobileTextStyle}
              >
                {previewContent.isHtml ? (
                  <div
                    className="whitespace-pre text-center overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: previewContent.body }}
                  />
                ) : (
                  <pre className="whitespace-pre m-0 text-center overflow-hidden">
                    {previewContent.body}
                  </pre>
                )}
              </div>
            </div>

            {/* Mobile watermark - smaller */}
            {isFreeTier && (
              <div className="absolute bottom-1 right-2 text-[6px] uppercase tracking-wider text-white/80">
                ascii.video
              </div>
            )}

            {/* Mobile overlay - tap to expand hint */}
            <div className="absolute top-2 left-2 text-[8px] text-dim bg-black/60 px-2 py-1 rounded">
              {mobileFontSize}px • {frameMetrics.width}×{frameMetrics.height}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-black/60 border border-dim/60 px-3 py-2 mx-2 mb-3 rounded">
        <div className="text-[9px] text-dim uppercase tracking-wider font-mono">
          {status}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2 px-2 mb-4">
        <div className="bg-black/40 border border-dim/60 p-2 text-center">
          <div className="text-xs text-accent font-mono">{charPixelSize}px</div>
          <div className="text-[9px] text-dim uppercase">Export Size</div>
        </div>
        <div className="bg-black/40 border border-dim/60 p-2 text-center">
          <div className="text-xs text-accent font-mono">{contrast.toFixed(2)}×</div>
          <div className="text-[9px] text-dim uppercase">Contrast</div>
        </div>
      </div>

      {/* Tier Display */}
      <div className="mx-2 mb-20"> {/* mb-20 to account for mobile controls */}
        <div
          className={clsx(
            "text-center py-2 px-3 border border-dim/60 text-[10px] uppercase tracking-wider",
            isFreeTier ? "text-dim bg-black/40" : "text-accent bg-accent/10"
          )}
        >
          {isFreeTier ? "Free Tier • With Watermark" : "Premium Tier • No Watermark"}
        </div>
      </div>
    </div>
  );
}