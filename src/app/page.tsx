"use client";

import { ChangeEvent, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { FFmpeg } from "@ffmpeg/ffmpeg";

import { useAuth } from "@/contexts/auth-context";

const CHARACTER_PRESETS = [
  { label: "Dense Symbols", value: "dense", charset: "@#%$&8BWMX*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. " },
  { label: "Blocks", value: "blocks", charset: "█▓▒░#*+=-:. " },
  { label: "Minimal", value: "minimal", charset: "@$%#*+=-:. " },
] as const;

const COLOR_SCHEMES = [
  { label: "Matrix Green", value: "matrix", foreground: "#33ff66", accent: "#00b140" },
  { label: "Amber", value: "amber", foreground: "#ffbf00", accent: "#d17c00" },
  { label: "Monochrome", value: "mono", foreground: "#f0f0f0", accent: "#aaaaaa" },
  { label: "Cyberpunk", value: "cyber", foreground: "#00f6ff", accent: "#ff00f7" },
] as const;

const PREVIEW_PLACEHOLDER = `READY> INIT ASCII ENGINE\nREADY> INSERT MEDIA_....\nREADY> WAITING_FOR_UPLOAD\n`;
const DEFAULT_VIDEO_PATH = "/input_video.mp4";
const VIEWPORT_WIDTH = 960;
const VIEWPORT_HEIGHT = 540;
const DEFAULT_ASPECT = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
const PREVIEW_FPS = 12;
const STRIPE_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "https://buy.stripe.com/5kQ5kD621bPxaLOaJN";

const FREE_EXPORT_CONFIG = {
  fps: 10,
  minCharPixel: 8,
  maxCharPixel: 12,
  watermark: "create your ascii video at https://ascii.video",
} as const;

const PREMIUM_EXPORT_CONFIG = {
  fps: 24,
  minCharPixel: 6,
  maxCharPixel: 12,
  watermark: null as string | null,
} as const;

const EXPORT_FORMATS = ["gif", "mp4", "mov"] as const;

type CharsetId = (typeof CHARACTER_PRESETS)[number]["value"];
type ColorSchemeId = (typeof COLOR_SCHEMES)[number]["value"];
type ExportFormat = (typeof EXPORT_FORMATS)[number];

type AsciiCell = {
  char: string;
  color: string;
  brightness: number;
};

type AsciiFrame = {
  width: number;
  height: number;
  charWidth: number;
  charHeight: number;
  rows: AsciiCell[][];
};

type Scheme = (typeof COLOR_SCHEMES)[number];

type ExportState = {
  status: "idle" | "initializing" | "sampling" | "encoding" | "delivering" | "error" | "done";
  format: ExportFormat | null;
  progress: number;
  message?: string;
};

const OUTPUT_NAME: Record<ExportFormat, string> = {
  gif: "ascii-output.gif",
  mp4: "ascii-output.mp4",
  mov: "ascii-output.mov",
};

const MIME_BY_FORMAT: Record<ExportFormat, string> = {
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.replace(/./g, (c) => c + c) : normalized;
  const int = parseInt(value, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function mixColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, ratio: number) {
  return {
    r: Math.round(a.r * (1 - ratio) + b.r * ratio),
    g: Math.round(a.g * (1 - ratio) + b.g * ratio),
    b: Math.round(a.b * (1 - ratio) + b.b * ratio),
  };
}

function rgbToCss({ r, g, b }: { r: number; g: number; b: number }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function computeGrid(video: HTMLVideoElement, charPixelSize: number) {
  const charWidth = Math.max(1, charPixelSize * 0.62);
  const charHeight = charPixelSize * 1.2;
  const videoAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : DEFAULT_ASPECT;
  const rows = Math.max(12, Math.floor(VIEWPORT_HEIGHT / charHeight));
  const cols = Math.max(16, Math.floor(rows * videoAspect * (charHeight / charWidth)));
  return { width: cols, height: rows, charWidth, charHeight };
}

function brightnessFor(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function asciiFromVideo(
  video: HTMLVideoElement,
  bufferCanvas: HTMLCanvasElement,
  charset: string,
  scheme: Scheme,
  charPixelSize: number,
  contrast: number,
): AsciiFrame | null {
  const { width, height, charWidth, charHeight } = computeGrid(video, charPixelSize);
  const context = bufferCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  bufferCanvas.width = width;
  bufferCanvas.height = height;
  context.imageSmoothingEnabled = true;
  context.drawImage(video, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const rows: AsciiCell[][] = new Array(height);
  const accentRgb = hexToRgb(scheme.accent);
  const foregroundRgb = hexToRgb(scheme.foreground);
  const clampedContrast = Math.max(0.2, Math.min(2.5, contrast));

  for (let y = 0; y < height; y++) {
    const row: AsciiCell[] = new Array(width);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const bright = brightnessFor(r, g, b);
      const adjusted = Math.max(0, Math.min(1, (bright - 0.5) * clampedContrast + 0.5));
      const index = Math.max(0, Math.min(charset.length - 1, Math.round((1 - adjusted) * (charset.length - 1))));
      const char = charset[index] ?? " ";
      const blended = mixColor(accentRgb, foregroundRgb, adjusted);
      const color = rgbToCss(blended);

      row[x] = {
        char,
        color,
        brightness: adjusted,
      };
    }
    rows[y] = row;
  }

  return { width, height, charWidth, charHeight, rows };
}

function escapeChar(char: string) {
  switch (char) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case " ":
      return "&nbsp;";
    default:
      return char;
  }
}

function frameToHtml(frame: AsciiFrame) {
  return frame.rows
    .map((row) => row.map((cell) => `<span style="color:${cell.color}">${escapeChar(cell.char)}</span>`).join(""))
    .join("<br/>");
}

async function canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob"));
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        } catch (error) {
          reject(error);
        }
      },
      "image/png",
      1.0
    );
  });
}

function clampTime(duration: number, time: number) {
  if (duration === Infinity || Number.isNaN(duration)) return time;
  return Math.min(Math.max(time, 0), Math.max(0, duration - 0.001));
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const target = clampTime(video.duration, time);
    let resolved = false;
    let timeout: number | null = null;

    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      if (timeout) window.clearTimeout(timeout);
    };

    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      video.pause();
      resolve();
    };

    const fail = (reason: string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error(reason));
    };

    const handleSeeked = () => {
      // Accept any seek result - don't be picky about precision
      finish();
    };

    // Much shorter timeout for faster processing
    timeout = window.setTimeout(() => {
      // Even if seek times out, continue anyway
      finish();
    }, 800);

    video.addEventListener("seeked", handleSeeked, { once: true });

    try {
      video.pause();
      video.currentTime = target;
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  });
}

async function ensureFfmpeg(ffmpegRef: MutableRefObject<FFmpeg | null>) {
  if (ffmpegRef.current) return ffmpegRef.current;

  try {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      console.log("FFmpeg:", message);
    });

    await ffmpeg.load();
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  } catch (error) {
    console.error("Failed to load FFmpeg:", error);
    throw new Error(
      "Failed to initialize video encoder. Please ensure your browser supports SharedArrayBuffer and CORS headers are properly configured."
    );
  }
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const asciiFrameRef = useRef<AsciiFrame | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const { user, entitlement, signOut, loadingSession, loadingProfile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [charsetId, setCharsetId] = useState<CharsetId>(CHARACTER_PRESETS[0].value);
  const [charPixelSize, setCharPixelSize] = useState(10);
  const [contrast, setContrast] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [colorScheme, setColorScheme] = useState<ColorSchemeId>(COLOR_SCHEMES[0].value);
  const [videoAspect, setVideoAspect] = useState(DEFAULT_ASPECT);
  const [status, setStatus] = useState("READY> INIT ASCII ENGINE");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ body: string; isHtml: boolean }>({
    body: PREVIEW_PLACEHOLDER,
    isHtml: false,
  });
  const [exportState, setExportState] = useState<ExportState>({ status: "idle", format: null, progress: 0 });
  const [hasLoadedDefault, setHasLoadedDefault] = useState(false);
  const [frameMetrics, setFrameMetrics] = useState<{ width: number; height: number; charWidth: number; charHeight: number }>(
    {
      width: 0,
      height: 0,
      charWidth: charPixelSize * 0.62,
      charHeight: charPixelSize * 1.2,
    },
  );
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [signOutPending, setSignOutPending] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  const charPixelRef = useRef(charPixelSize);
  const contrastRef = useRef(contrast);

  const charset = useMemo(
    () => CHARACTER_PRESETS.find((preset) => preset.value === charsetId)?.charset ?? CHARACTER_PRESETS[0].charset,
    [charsetId],
  );

  const chosenScheme = useMemo(
    () => COLOR_SCHEMES.find((scheme) => scheme.value === colorScheme) ?? COLOR_SCHEMES[0],
    [colorScheme],
  );

  const tierConfig = useMemo(
    () => (entitlement === "premium" ? PREMIUM_EXPORT_CONFIG : FREE_EXPORT_CONFIG),
    [entitlement],
  );

  const charPixelLimits = useMemo(
    () => ({
      min: tierConfig.minCharPixel,
      max: tierConfig.maxCharPixel,
    }),
    [tierConfig],
  );
  const isAuthLoading = loadingSession || loadingProfile;
  const isFreeTier = entitlement !== "premium";

  const previewFontSize = charPixelSize;
  const previewLineHeight = previewFontSize * 1.18;
  const previewTextStyle = useMemo(
    () => ({
      fontSize: `${previewFontSize}px`,
      lineHeight: `${previewLineHeight}px`,
      maxWidth: "100%",
      maxHeight: "100%",
    }),
    [previewFontSize, previewLineHeight],
  );

  const previewWidth = useMemo(() => VIEWPORT_HEIGHT * videoAspect, [videoAspect]);

  const previewContainerStyle = useMemo(
    () => ({
      width: `${previewWidth}px`,
      height: `${VIEWPORT_HEIGHT}px`,
    }),
    [previewWidth],
  );

  const metadataWidthStyle = useMemo(
    () => ({
      width: `${previewWidth}px`,
    }),
    [previewWidth],
  );

  const exportIdle = useMemo(
    () => exportState.status === "idle" || exportState.status === "error" || exportState.status === "done",
    [exportState.status],
  );
  const canExport = Boolean(user && selectedFile && exportIdle);

  useEffect(() => {
    charPixelRef.current = charPixelSize;
  }, [charPixelSize]);

  useEffect(() => {
    contrastRef.current = contrast;
  }, [contrast]);

  useEffect(() => {
    if (user) {
      setShowRegisterPrompt(false);
    }
  }, [user]);

  // Clamp character pixel size when tier changes
  useEffect(() => {
    if (charPixelSize < charPixelLimits.min) {
      setCharPixelSize(charPixelLimits.min);
    } else if (charPixelSize > charPixelLimits.max) {
      setCharPixelSize(charPixelLimits.max);
    }
  }, [charPixelLimits.min, charPixelLimits.max, charPixelSize]);

  useEffect(() => {
    if (!checkoutMessage) return;
    const timer = window.setTimeout(() => setCheckoutMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [checkoutMessage]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFile || hasLoadedDefault) return;
    let cancelled = false;

    const loadDefault = async () => {
      try {
        const response = await fetch(DEFAULT_VIDEO_PATH);
        if (!response.ok) throw new Error(`Default video not found (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;
        const placeholderFile = new File([blob], "input_video.mp4", { type: blob.type || "video/mp4" });
        setSelectedFile(placeholderFile);
      } catch (error) {
        console.warn("default video load failed", error);
      } finally {
        if (!cancelled) setHasLoadedDefault(true);
      }
    };

    loadDefault();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, hasLoadedDefault]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewContent({ body: PREVIEW_PLACEHOLDER, isHtml: false });
      setStatus("READY> WAITING_FOR_UPLOAD");
      setIsVideoReady(false);
      if (previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      return;
    }

    setStatus("LOAD> staging video...");

    if (previewTimerRef.current) {
      window.clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    const handleLoaded = async () => {
      const grid = computeGrid(video, charPixelRef.current);
      const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : DEFAULT_ASPECT;
      setVideoAspect(aspect);
      setStatus(
        `LOAD> ${video.duration.toFixed(1)}s @ ${video.videoWidth}x${video.videoHeight} | grid ${grid.width}x${grid.height} | char ${charPixelRef.current}px`,
      );
      setIsVideoReady(true);
      try {
        await video.play();
      } catch (error) {
        console.warn("autoplay blocked", error);
      }
    };

    const handleError = () => {
      setStatus("ERROR> unable to decode video");
      setIsVideoReady(false);
    };

    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
    videoRef.current = video;

    return () => {
      video.pause();
      video.src = "";
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;
    const video = videoRef.current;
    const bufferCanvas = bufferCanvasRef.current ?? document.createElement("canvas");
    bufferCanvasRef.current = bufferCanvas;

    const tick = () => {
      const frame = asciiFromVideo(video, bufferCanvas, charset, chosenScheme, charPixelRef.current, contrastRef.current);
      if (!frame) return;
      asciiFrameRef.current = frame;
      setFrameMetrics((prev) =>
        prev.width === frame.width && prev.height === frame.height && prev.charWidth === frame.charWidth
          ? prev
          : {
              width: frame.width,
              height: frame.height,
              charWidth: frame.charWidth,
              charHeight: frame.charHeight,
            },
      );

      setPreviewContent({ body: frameToHtml(frame), isHtml: true });

      setStatus(
        `PLAY> ${video.currentTime.toFixed(1)}s/${video.duration.toFixed(1)}s | grid ${frame.width}x${frame.height} | char ${charPixelRef.current}px`,
      );
    };

    const startLoop = () => {
      if (previewTimerRef.current) return;
      if (isPlaying) {
        video.play().catch(() => undefined);
      }
      tick();
      previewTimerRef.current = window.setInterval(() => {
        if (isPlaying) {
          if (video.paused) {
            video.play().catch(() => undefined);
          }
          tick();
        } else if (!video.paused) {
          video.pause();
        }
      }, Math.max(40, Math.round(1000 / PREVIEW_FPS)));
    };

    const stopLoop = () => {
      if (previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      video.pause();
    };

    if (isPlaying) {
      startLoop();
    } else {
      stopLoop();
    }

    return () => {
      stopLoop();
    };
  }, [isVideoReady, charset, chosenScheme, charPixelSize, isPlaying, contrast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const startCheckout = useCallback(() => {
    if (checkoutPending) return;
    if (!user) {
      setCheckoutMessage("upgrade> login required");
      setStatus("UPGRADE> login required to initiate premium checkout");
      return;
    }

    setCheckoutPending(true);

    try {
      const target = new URL(STRIPE_PAYMENT_LINK);
      if (user.email) {
        target.searchParams.set("prefilled_email", user.email);
      }
      target.searchParams.set("client_reference_id", user.id);
      setCheckoutMessage("upgrade> checkout opening in new tab _");
      setStatus("UPGRADE> checkout opened in new tab");
      if (typeof window !== "undefined") {
        window.open(target.toString(), "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      setCheckoutMessage(`error> ${message}`);
      setStatus(`ERROR> ${message}`);
    } finally {
      setCheckoutPending(false);
    }
  }, [checkoutPending, user]);

  const handleSignOut = useCallback(async () => {
    if (signOutPending) return;
    setSignOutPending(true);
    try {
      await signOut();
      setStatus("AUTH> session terminated");
      setCheckoutMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      setStatus(`ERROR> sign out failed :: ${message}`);
    } finally {
      setSignOutPending(false);
    }
  }, [signOut, signOutPending]);

  const handleExport = async (format: ExportFormat) => {
    if (!selectedFile) return;

    setStatus(
      isFreeTier
        ? `EXPORT> free tier engaged :: ${tierConfig.fps}fps with watermark`
        : `EXPORT> premium tier engaged :: ${tierConfig.fps}fps high fidelity`,
    );

    const samplingVideo = document.createElement("video");
    samplingVideo.muted = true;
    samplingVideo.preload = "auto";
    samplingVideo.crossOrigin = "anonymous";
    samplingVideo.playsInline = true;

    let objectUrl: string | null = null;
    let outputName: string | null = null;
    let totalFrames = 0;
    // Keep the preview video playing during export for better UX

    try {
      setExportState({ status: "initializing", format, progress: 0.05, message: "Loading encoder" });
      const ffmpeg = await ensureFfmpeg(ffmpegRef);

      setExportState({ status: "sampling", format, progress: 0.1, message: "Sampling frames" });

      objectUrl = URL.createObjectURL(selectedFile);
      samplingVideo.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () => reject(new Error("Unable to read video for export"));
        samplingVideo.addEventListener("loadedmetadata", onLoaded, { once: true });
        samplingVideo.addEventListener("error", onError, { once: true });
      });

      const duration = samplingVideo.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Video duration unavailable for export");
      }

      try {
        samplingVideo.currentTime = 0;
        await samplingVideo.play();
        samplingVideo.pause();
      } catch {
        // autoplay might be blocked; continue regardless
        samplingVideo.currentTime = 0;
      }

      if (samplingVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve) => {
          const handle = () => {
            samplingVideo.removeEventListener("canplay", handle);
            resolve();
          };
          samplingVideo.addEventListener("canplay", handle, { once: true });
          try {
            void samplingVideo.play().catch(() => undefined);
          } catch {
            // ignore
          }
        });
        samplingVideo.pause();
      }

      const fps = tierConfig.fps;

      // Limit max frames for faster processing on long videos
      const maxFrames = isFreeTier ? 300 : 600; // 30s@10fps / 25s@24fps
      const idealFrames = Math.ceil(duration * fps);
      totalFrames = Math.min(idealFrames, maxFrames);

      const step = totalFrames > 1 ? duration / (totalFrames - 1) : 0;

      if (idealFrames > totalFrames) {
        setExportState({
          status: "sampling",
          format,
          progress: 0.1,
          message: `Video truncated to ${totalFrames} frames for faster processing`
        });
      }

      const bufferCanvas = document.createElement("canvas");
      const exportCanvas = exportCanvasRef.current ?? document.createElement("canvas");
      exportCanvasRef.current = exportCanvas;
      const exportContext = exportCanvas.getContext("2d");
      if (!exportContext) {
        throw new Error("Canvas context unavailable");
      }

      for (let index = 0; index < totalFrames; index++) {
        const targetTime = clampTime(duration, step === 0 ? 0 : index * step);
        try {
          await seekVideo(samplingVideo, targetTime);
        } catch (error) {
          console.warn("frame seek failed", error);
          continue;
        }
        const frame = asciiFromVideo(
          samplingVideo,
          bufferCanvas,
          charset,
          chosenScheme,
          charPixelRef.current,
          contrastRef.current,
        );
        if (!frame) continue;

        const fontSize = Math.min(12, Math.max(tierConfig.minCharPixel, charPixelRef.current));
        const cellHeight = fontSize * 1.2;
        const cellWidth = fontSize * 0.62;
        exportCanvas.width = Math.floor(frame.width * cellWidth);
        exportCanvas.height = Math.floor(frame.height * cellHeight);
        exportContext.fillStyle = "#000000";
        exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        const asciiFont = `${fontSize}px "Menlo", "Fira Code", monospace`;
        exportContext.font = asciiFont;
        exportContext.textBaseline = "top";
        exportContext.textAlign = "left";

        // Batch text rendering by color to reduce fillStyle changes
        const colorGroups = new Map<string, Array<{char: string, x: number, y: number}>>();

        for (let y = 0; y < frame.height; y++) {
          const row = frame.rows[y];
          for (let x = 0; x < frame.width; x++) {
            const cell = row[x];
            if (!colorGroups.has(cell.color)) {
              colorGroups.set(cell.color, []);
            }
            colorGroups.get(cell.color)!.push({
              char: cell.char,
              x: x * cellWidth,
              y: y * cellHeight
            });
          }
        }

        // Draw all characters of the same color together
        for (const [color, chars] of colorGroups) {
          exportContext.fillStyle = color;
          for (const {char, x, y} of chars) {
            exportContext.fillText(char, x, y);
          }
        }

        if (tierConfig.watermark) {
          exportContext.font = `${Math.max(12, Math.round(fontSize * 0.9))}px "Menlo", "Fira Code", monospace`;
          exportContext.textAlign = "right";
          exportContext.textBaseline = "bottom";
          exportContext.fillStyle = "#ffffff";
          exportContext.fillText(tierConfig.watermark, exportCanvas.width - 12, exportCanvas.height - 8);
          exportContext.textAlign = "left";
          exportContext.textBaseline = "top";
          exportContext.font = asciiFont;
        }

        const frameName = `frame_${String(index).padStart(4, "0")}.png`;
        try {
          const pngBytes = await canvasToUint8Array(exportCanvas);
          await ffmpeg.writeFile(frameName, pngBytes);
        } catch (error) {
          console.error(`Failed to process frame ${index}:`, error);
          throw new Error(`Frame processing failed at frame ${index + 1}`);
        }
        setExportState({
          status: "sampling",
          format,
          progress: 0.1 + (index / totalFrames) * 0.5,
          message: `Captured frame ${index + 1} / ${totalFrames}`,
        });
      }

      samplingVideo.pause();
      samplingVideo.src = "";

      if (totalFrames === 0) {
        throw new Error("No frames captured for export");
      }

      outputName = OUTPUT_NAME[format];
      const args = ["-framerate", `${fps}`, "-i", "frame_%04d.png"];
      if (format === "gif") {
        args.push("-vf", "scale=iw:ih:flags=lanczos", "-loop", "0", outputName);
      } else if (format === "mov") {
        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputName);
      } else {
        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", outputName);
      }

      setExportState({ status: "encoding", format, progress: 0.7, message: "Encoding media" });
      await ffmpeg.exec(args);

      setExportState({ status: "delivering", format, progress: 0.9, message: "Preparing download" });
      const data = await ffmpeg.readFile(outputName);
      const byteData = data instanceof Uint8Array ? data : new Uint8Array(new TextEncoder().encode(data));
      const blob = new Blob([byteData], { type: MIME_BY_FORMAT[format] });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = OUTPUT_NAME[format];
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 2000);

      setExportState({ status: "done", format, progress: 1, message: `Exported ${OUTPUT_NAME[format]}` });
      setTimeout(() => setExportState({ status: "idle", format: null, progress: 0 }), 2400);
      setStatus(`EXPORT> completed .${format}`);
    } catch (error) {
      console.error(error);
      let errorMessage = "Export failed";

      if (error instanceof Error) {
        if (error.message.includes("out of memory") || error.message.includes("OutOfMemoryError")) {
          errorMessage = "Insufficient memory for export. Try reducing video length or character size.";
        } else if (error.message.includes("SharedArrayBuffer")) {
          errorMessage = "Browser compatibility issue. Please refresh and try again.";
        } else if (error.message.includes("FFmpeg")) {
          errorMessage = "Video encoding failed. Please try again or use a different format.";
        } else {
          errorMessage = error.message;
        }
      }

      setExportState({
        status: "error",
        format,
        progress: 0,
        message: errorMessage,
      });
      setStatus(`ERROR> ${errorMessage}`);
    } finally {
      samplingVideo.pause();
      samplingVideo.src = "";
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      // Clean up all frame files
      const ffmpegInstance = ffmpegRef.current;
      if (ffmpegInstance) {
        try {
          // Clean up all frame files that might have been created
          for (let i = 0; i < totalFrames; i++) {
            const frameName = `frame_${String(i).padStart(4, "0")}.png`;
            try {
              await ffmpegInstance.deleteFile(frameName);
            } catch {
              // file might not exist, continue
            }
          }

          // Clean up output file if it exists
          if (outputName) {
            try {
              await ffmpegInstance.deleteFile(outputName);
            } catch {
              // already removed or never created
            }
          }
        } catch (error) {
          console.warn("cleanup failed", error);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[10px] uppercase tracking-[0.2em] sm:px-8">
        <div className="text-accent">ascii.video</div>
        <div className="flex flex-wrap items-center gap-2">
          {isAuthLoading ? (
            <span className="text-dim">auth&gt; syncing...</span>
          ) : user ? (
            <>
              <span className="max-w-[180px] truncate text-dim">id {user.email}</span>
              <span
                className={clsx(
                  "px-2 py-1",
                  isFreeTier ? "text-dim" : "text-accent",
                )}
              >
                tier: {entitlement}
              </span>
              {isFreeTier ? (
                <button
                  onClick={startCheckout}
                  disabled={checkoutPending}
                className="px-3 py-1 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  upgrade
                </button>
              ) : null}
              <button
                onClick={handleSignOut}
                disabled={signOutPending}
                className="px-3 py-1 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent">login</Link>
              <Link href="/register" className="hover:text-accent">register</Link>
            </>
          )}
        </div>
      </div>
      {checkoutMessage ? (
        <div className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-dim sm:px-8">
          {checkoutMessage}
        </div>
      ) : null}
      <div className="grid md:grid-cols-[420px_1fr] lg:grid-cols-[480px_1fr] grid-rows-[auto_1fr] md:grid-rows-1 text-sm">
<aside className="bg-background/90 p-3 md:p-4 lg:p-5 flex flex-col gap-2.5">

        <section className="flex flex-col gap-1.5">
          <button
            onClick={handleUploadClick}
            className="group relative w-full overflow-hidden rounded border border-dim px-4 py-2.5 uppercase tracking-[0.18em] text-[11px] transition"
            style={{
              background: selectedFile
                ? "linear-gradient(120deg, rgba(0, 177, 64, 0.65) 0%, rgba(51, 255, 102, 0.85) 40%, rgba(0, 177, 64, 0.65) 100%)"
                : "transparent",
            }}
          >
            {selectedFile ? (
              <span className="pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_right,transparent,black,transparent)]">
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_2s_infinite]" />
              </span>
            ) : null}
            <span className={selectedFile ? "relative z-10 text-black" : undefined}>
              {selectedFile ? "Replace Video" : "Upload Video"}
            </span>
          </button>
          <p className="text-[10px] text-dim leading-relaxed">
            Supported: mp4, mov, webm, avi. Files over two minutes will be truncated to keep exports responsive.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <div className="border border-dim/60 bg-black/40 px-3 py-2 text-[11px] leading-relaxed">
              <div className="truncate uppercase text-[10px]">{selectedFile.name}</div>
              <div className="text-dim">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-1.5 border border-dim/60 p-2.5">
          <span className="text-[10px] tracking-[0.18em] uppercase text-accent">Character Style</span>
          <div className="flex flex-col gap-2">
            {CHARACTER_PRESETS.map((preset) => (
              <label
                key={preset.value}
                className={clsx(
                  "flex items-center gap-3 border border-dim/60 px-3 py-2 cursor-pointer transition-colors text-[11px]",
                  preset.value === charsetId && "border-accent bg-accent/10",
                )}
                style={{ accentColor: chosenScheme.accent }}
              >
                <input
                  type="radio"
                  name="charset"
                  value={preset.value}
                  checked={charsetId === preset.value}
                  onChange={() => setCharsetId(preset.value)}
                />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em]">{preset.label}</div>
                  <div className="text-[9px] text-dim truncate max-w-[200px]">{preset.charset}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <div className="grid gap-3">
          <section className="flex flex-col gap-1.5 border border-dim/60 p-2.5">
            <span className="text-[10px] tracking-[0.18em] uppercase text-accent">Character Pixel Size</span>
            <input
              type="range"
              min={charPixelLimits.min}
              max={charPixelLimits.max}
              step={1}
              value={charPixelSize}
              onChange={(event) => setCharPixelSize(Number(event.target.value))}
              className="w-full"
              style={{ accentColor: chosenScheme.accent }}
            />
            <div className="flex justify-between text-[10px] text-dim">
              <span>{charPixelLimits.min} px</span>
              <span>{charPixelSize}px</span>
              <span>{charPixelLimits.max} px</span>
            </div>
          </section>

          <section className="flex flex-col gap-1.5 border border-dim/60 p-2.5">
            <span className="text-[10px] tracking-[0.18em] uppercase text-accent">Contrast</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))}
              className="w-full"
              style={{ accentColor: chosenScheme.accent }}
            />
            <div className="flex justify-between text-[10px] text-dim">
              <span>0.5x</span>
              <span>{contrast.toFixed(2)}x</span>
              <span>2.0x</span>
            </div>
          </section>

          <section className="flex flex-col gap-1.5 border border-dim/60 p-2.5">
            <span className="text-[10px] tracking-[0.18em] uppercase text-accent">Terminal Theme</span>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.value}
                  onClick={() => setColorScheme(scheme.value)}
                  className={clsx(
                    "border border-dim/60 p-2 text-left text-[11px]",
                    colorScheme === scheme.value && "border-accent bg-accent/10",
                  )}
                  style={{ color: scheme.foreground }}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em]">{scheme.label}</div>
                  <div className="text-[9px] text-dim" style={{ color: scheme.accent }}>
                    {scheme.foreground}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="relative bg-black/60 flex flex-col items-center justify-start gap-4 p-4 md:p-8 text-[11px]">
        <div className="mx-auto" style={previewContainerStyle}>
          <div className="relative w-full h-full overflow-hidden rounded border border-dim/60 bg-black/80 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
            <div className="absolute inset-0 flex items-center justify-center" style={{ color: chosenScheme.foreground }}>
              <div className="font-mono overflow-hidden w-full h-full flex items-center justify-center" style={previewTextStyle}>
                {previewContent.isHtml ? (
                  <div className="whitespace-pre text-center" dangerouslySetInnerHTML={{ __html: previewContent.body }} />
                ) : (
                  <pre className="whitespace-pre m-0 text-center">{previewContent.body}</pre>
                )}
              </div>
            </div>
            {isFreeTier ? (
              <div
                className="absolute bottom-2 right-3 text-[9px] uppercase tracking-[0.18em] text-white"
                onMouseEnter={() => setShowRegisterPrompt(true)}
                onMouseLeave={() => setShowRegisterPrompt(false)}
              >
                <span className="pointer-events-none">create your ascii video at https://ascii.video</span>
                {showRegisterPrompt ? (
                  <div className="pointer-events-auto absolute bottom-full right-0 mb-2 w-max max-w-xs border border-dim/60 bg-black/80 px-3 py-2 text-[9px] text-dim">
                    remove watermark with premium upgrade
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto flex flex-col gap-3" style={metadataWidthStyle}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-dim">
            <span>char {charPixelSize}px</span>
            <span>grid {frameMetrics.width}x{frameMetrics.height}</span>
            <span>contrast {contrast.toFixed(2)}x</span>
            <span>fps {PREVIEW_FPS}</span>
          </div>
          <div className="text-[9px] text-dim uppercase tracking-[0.18em]">{status}</div>
          <div className="text-[9px] text-dim uppercase tracking-[0.18em]">
            {isFreeTier
              ? `free tier :: exports capped at ${tierConfig.fps}fps with watermark`
              : `premium tier :: exports at ${tierConfig.fps}fps with no watermark`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className="border border-dim/60 px-4 py-2 uppercase tracking-[0.18em] text-[11px]"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            {EXPORT_FORMATS.map((format) => {
              const disabled = !canExport;
              return (
                <div
                  key={format}
                  onMouseEnter={() => {
                    if (!user) {
                      setShowRegisterPrompt(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!user) {
                      setShowRegisterPrompt(false);
                    }
                  }}
                >
                  <button
                    onClick={() => {
                      if (!user) {
                        setShowRegisterPrompt(true);
                        setStatus("AUTH> register to unlock downloads");
                        return;
                      }
                      if (disabled) return;
                      void handleExport(format);
                    }}
                    disabled={disabled}
                    className={clsx(
                      "border border-dim/60 px-4 py-2 uppercase tracking-[0.18em] text-[11px]",
                      disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-accent/10",
                    )}
                  >
                    .{format}
                  </button>
                </div>
              );
            })}
          </div>
          {!user && showRegisterPrompt ? (
            <div className="border border-dim/60 bg-black/50 p-2 text-[10px] uppercase tracking-[0.18em] text-dim">
              authenticate to export ::
              <span className="mx-1 text-foreground">
                <Link href="/register" className="text-accent hover:underline">
                  register
                </Link>
              </span>
              or
              <span className="mx-1 text-foreground">
                <Link href="/login" className="text-accent hover:underline">
                  login
                </Link>
              </span>
              first.
            </div>
          ) : null}
          {exportState.status !== "idle" && (
            <div className="text-[10px] text-dim border border-dim/60 p-2">
              <div>
                {exportState.message ?? `${exportState.status}...`} ({Math.round(exportState.progress * 100)}%)
              </div>
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
