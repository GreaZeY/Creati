import { useState, useRef, useEffect, useCallback } from "react";
import type Moveable from "react-moveable";
import type { OverlayItem, ProcessingSettings } from "./VideoEditorModal";
import { useStudio } from "../../context/StudioProvider";

let overlayIdCounter = 0;
function generateId() {
  return `overlay-${Date.now()}-${++overlayIdCounter}`;
}

interface UseVideoEditorArgs {
  isOpen: boolean;
  initialSettings?: ProcessingSettings;
  video: {
    id: string;
    url?: string;
    previewUrl?: string;
  };
  onSave: (id: string, settings: ProcessingSettings) => void;
  onClose: () => void;
}

export function useVideoEditor({
  isOpen,
  initialSettings,
  video,
  onSave,
  onClose,
}: UseVideoEditorArgs) {
  const { 
    state, 
    updateVideo, 
    addOverlay, 
    updateOverlay: studioUpdateOverlay, 
    removeOverlay: studioRemoveOverlay,
    setCurrentTime: studioSetCurrentTime,
    togglePlayback: studioTogglePlayback,
    setIsPlaying: studioSetIsPlaying,
    selectElement
  } = useStudio();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(
    null,
  );

  // Container dimensions for pixel-based positioning
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // ── Effects ──

  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialSettings) {
      updateVideo({
        trimStart: initialSettings.trim_start || 0,
        trimEnd: initialSettings.trim_end || state.video.duration,
      });
      // Import existing overlays into studio
      initialSettings.overlays.forEach(ov => addOverlay(ov));
    }
  }, [isOpen, initialSettings?.overlays.length]);

  useEffect(() => {
    if (state.selectedElementId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`overlay-${state.selectedElementId}`);
        setMoveableTarget(el || null);
      });
    } else {
      setMoveableTarget(null);
    }
  }, [state.selectedElementId]);

  const selected = state.overlays.find((o) => o.id === state.selectedElementId);
  useEffect(() => {
    if (moveableRef.current && state.selectedElementId) {
      requestAnimationFrame(() => {
        moveableRef.current?.updateRect();
      });
    }
  }, [
    state.selectedElementId,
    selected?.fontSize,
    selected?.width,
    selected?.height,
    selected?.rotation,
    selected?.text,
    selected?.fontFamily,
    selected?.bgColor,
  ]);

  // ── Playback handlers ──

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      updateVideo({
        duration: dur,
        trimEnd: initialSettings?.trim_end ?? dur,
        trimStart: initialSettings?.trim_start ?? 0,
      });
    }
  }, [initialSettings]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      studioSetCurrentTime(curr);
      if (state.video.trimEnd > 0 && curr > state.video.trimEnd) {
        videoRef.current.currentTime = state.video.trimStart;
      }
    }
  }, [state.video.trimStart, state.video.trimEnd, studioSetCurrentTime]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (state.isPlaying) {
      videoRef.current.pause();
    } else {
      if (
        state.video.trimEnd > 0 &&
        (videoRef.current.currentTime < state.video.trimStart ||
          videoRef.current.currentTime >= state.video.trimEnd)
      ) {
        videoRef.current.currentTime = state.video.trimStart;
      }
      videoRef.current.play();
    }
    studioTogglePlayback();
  }, [state.isPlaying, state.video.trimStart, state.video.trimEnd, studioTogglePlayback]);

  const handleTrimChange = useCallback((start: number, end: number) => {
    updateVideo({ trimStart: start, trimEnd: end });
  }, [updateVideo]);

  // ── Overlay CRUD ──

  const addText = useCallback(() => {
    const item: OverlayItem = {
      id: generateId(),
      type: "text",
      x: 35,
      y: 40,
      width: 30,
      height: 10,
      rotation: 0,
      text: "Your Text",
      fontSize: 28,
      fontColor: "#ffffff",
      bgColor: "transparent",
      fontFamily: "sans-serif",
    };
    addOverlay(item);
  }, [addOverlay]);

  const addSticker = useCallback((emoji: string) => {
    const item: OverlayItem = {
      id: generateId(),
      type: "sticker",
      x: 40,
      y: 35,
      width: 15,
      height: 15,
      rotation: 0,
      src: emoji,
      fontColor: "#ffffff",
      bgColor: "transparent",
      fontFamily: "sans-serif",
    };
    addOverlay(item);
  }, [addOverlay]);

  const addImage = useCallback((dataUrl: string) => {
    const item: OverlayItem = {
      id: generateId(),
      type: "image",
      x: 30,
      y: 25,
      width: 30,
      height: 30,
      rotation: 0,
      src: dataUrl,
      fontColor: "#ffffff",
      bgColor: "transparent",
      fontFamily: "sans-serif",
    };
    addOverlay(item);
  }, [addOverlay]);

  const updateOverlay = useCallback(
    (id: string, updates: Partial<OverlayItem>) => {
      studioUpdateOverlay(id, updates);
    },
    [studioUpdateOverlay],
  );

  const deleteOverlay = useCallback(
    (id: string) => {
      studioRemoveOverlay(id);
    },
    [studioRemoveOverlay],
  );

  const selectOverlay = useCallback((id: string) => {
    selectElement(id);
  }, [selectElement]);

  const deselectAll = useCallback(() => {
    selectElement(null);
  }, [selectElement]);

  const handleSave = useCallback(() => {
    onSave(video.id, {
      trim_start: state.video.trimStart,
      trim_end: state.video.trimEnd,
      overlays: state.overlays,
    });
    onClose();
  }, [video.id, state.video.trimStart, state.video.trimEnd, state.overlays, onSave, onClose]);

  const pctToPx = useCallback(
    (pct: number, dimension: number) => (pct / 100) * dimension,
    [],
  );

  // Video Source with Proxy Logic
  // If URL is external (not our storage), route through proxy to bypass CORS
  const videoSrc = (() => {
    const rawUrl = video.previewUrl || video.url;
    if (!rawUrl) return "";
    
    // Check if it's a relative path or our own domain (safe)
    if (rawUrl.startsWith("/") || rawUrl.includes("localhost") || rawUrl.includes("creati.in")) {
      return rawUrl;
    }

    // It's external (e.g. Facebook, Instagram, AWS S3 direct), use proxy
    // Assuming backend is at /api relative to frontend or configured base URL
    // Since we are inside the app, we can use relative path if proxy set up in Vite
    // But backend is on port 8080 usually. Let's assume standard API path.
    // Ideally use an env var or a helper for API base URL.
    // For now, hardcode or use relative if proxy is set up.
    // Let's assume relative /api/proxy/video works via Vite proxy or direct if CORS allowed.
    // Wait, backend is on 8080. Frontend on 5173.
    // We added Access-Control-Allow-Origin: * to proxy response, so direct call to 8080 is fine.
    const baseUrl = "http://localhost:8080"; // TODO: Use env
    return `${baseUrl}/api/proxy/video?url=${encodeURIComponent(rawUrl)}`;
  })();

  return {
    // Refs
    videoRef,
    // ...
    videoSrc,
    canvasRef,
    moveableRef,
    // Playback
    isPlaying: state.isPlaying,
    setIsPlaying: studioSetIsPlaying,
    duration: state.video.duration,
    currentTime: state.currentTime,
    togglePlay,
    handleLoadedMetadata,
    handleTimeUpdate,
    // Trim
    trimStart: state.video.trimStart,
    trimEnd: state.video.trimEnd,
    handleTrimChange,
    // Overlays
    overlays: state.overlays,
    selectedId: state.selectedElementId,
    moveableTarget,
    addText,
    addSticker,
    addImage,
    updateOverlay,
    deleteOverlay,
    selectOverlay,
    deselectAll,
    // Layout
    containerSize,
    pctToPx,
    // Actions
    handleSave,
  };
}
