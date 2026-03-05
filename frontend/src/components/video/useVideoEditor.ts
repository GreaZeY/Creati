import { useState, useRef, useEffect, useCallback } from "react";
import type Moveable from "react-moveable";
import type { OverlayItem, ProcessingSettings } from "./VideoEditorModal";
import { useStudio } from "../../context/StudioProvider";
import { useFfmpeg } from "../../hooks/useFfmpeg";

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
    addVideoSegment,
    updateVideoSegment, 
    addOverlay, 
    updateOverlay: studioUpdateOverlay, 
    removeOverlay: studioRemoveOverlay,
    setCurrentTime: studioSetCurrentTime,
    togglePlayback: studioTogglePlayback,
    setIsPlaying: studioSetIsPlaying,
    selectElement
  } = useStudio();

  const { trimVideo, loaded: ffmpegLoaded } = useFfmpeg();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(
    null,
  );

  // Local state for baked/trimmed blob URLs to solve "original video" issue
  const [trimmedUrls, setTrimmedUrls] = useState<Record<string, string>>({});
  const [isBaking, setIsBaking] = useState(false);

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
      if (state.videoSegments.length > 0) {
        updateVideoSegment(state.videoSegments[0].id, {
          trimStart: initialSettings.trim_start || 0,
          trimEnd: initialSettings.trim_end || state.videoSegments[0].originalDuration,
        });
      }
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

  const activeSegment = state.videoSegments.find(
    seg => state.currentTime >= seg.startTime && state.currentTime < (seg.startTime + seg.duration)
  ) || state.videoSegments[0];
  // ── Synchronization ──

  // Forced synchronization between timeline and video element (Live Preview)
  useEffect(() => {
    if (!videoRef.current || state.isPlaying) return;

    if (activeSegment) {
      const isBaked = !!trimmedUrls[activeSegment.id];
      // If baked, the blob starts at 0. If original, it starts at trimStart.
      const internalTime = isBaked 
        ? (state.currentTime - activeSegment.startTime)
        : activeSegment.trimStart + (state.currentTime - activeSegment.startTime);
        
      // Only seek if the difference is significant to avoid flutter
      if (Math.abs(videoRef.current.currentTime - internalTime) > 0.05) {
        videoRef.current.currentTime = Math.max(0, internalTime);
      }
    }
  }, [state.currentTime, activeSegment, state.isPlaying, trimmedUrls]);

  // ── Playback handlers ──

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && state.videoSegments.length === 1) {
      const dur = videoRef.current.duration;
      updateVideoSegment(state.videoSegments[0].id, {
        duration: dur,
        originalDuration: dur,
        trimEnd: initialSettings?.trim_end ?? dur,
        trimStart: initialSettings?.trim_start ?? 0,
      });
      // Initial seek
      const isBaked = !!trimmedUrls[state.videoSegments[0].id];
      videoRef.current.currentTime = isBaked ? 0 : (initialSettings?.trim_start ?? 0);
    }
  }, [initialSettings, state.videoSegments.length, updateVideoSegment, trimmedUrls]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && state.isPlaying) {
      const videoTime = videoRef.current.currentTime;
      if (activeSegment) {
        const isBaked = !!trimmedUrls[activeSegment.id];
        const clipEnd = isBaked ? activeSegment.duration : activeSegment.trimEnd;

        // Boundary Guard: Stop if we reach trimEnd
        if (videoTime >= clipEnd) {
          videoRef.current.pause();
          studioSetIsPlaying(false);
          return;
        }

        const absoluteTime = isBaked
          ? activeSegment.startTime + videoTime
          : activeSegment.startTime + (videoTime - activeSegment.trimStart);
          
        studioSetCurrentTime(absoluteTime);
      }
    }
  }, [activeSegment, state.isPlaying, studioSetIsPlaying, studioSetCurrentTime, trimmedUrls]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (state.isPlaying) {
      videoRef.current.pause();
    } else {
      const isBaked = !!trimmedUrls[activeSegment?.id || ""];
      const currentInternalTime = videoRef.current.currentTime;
      const startLimit = isBaked ? 0 : (activeSegment?.trimStart || 0);
      const endLimit = isBaked ? (activeSegment?.duration || 0) : (activeSegment?.trimEnd || 0);

      if (activeSegment && (currentInternalTime >= endLimit || currentInternalTime < startLimit)) {
        videoRef.current.currentTime = startLimit;
      }
      videoRef.current.play();
    }
    studioTogglePlayback();
  }, [state.isPlaying, activeSegment, studioTogglePlayback, trimmedUrls]);

  const handleTrimChange = useCallback((id: string, start: number, end: number) => {
    updateVideoSegment(id, { trimStart: start, trimEnd: end, duration: end - start });
  }, [updateVideoSegment]);

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
      overlays: state.overlays,
      // The backend needs to know about multiple segments now
      video_segments: state.videoSegments, 
    } as any);
    onClose();
  }, [video.id, state.videoSegments, state.overlays, onSave, onClose]);

  const pctToPx = useCallback(
    (pct: number, dimension: number) => (pct / 100) * dimension,
    [],
  );

  // ── Baking (WASM Trimming) ──
  
  // Cache to track which bounds are currently baked
  const bakedBoundsRef = useRef<Record<string, { start: number; duration: number }>>({});

  useEffect(() => {
    if (!ffmpegLoaded) return;

    const bakeNextStaleSegment = async () => {
      for (const seg of state.videoSegments) {
        const currentBounds = bakedBoundsRef.current[seg.id];
        const hasChanged = !currentBounds || 
                          currentBounds.start !== seg.trimStart || 
                          currentBounds.duration !== seg.duration;

        if (hasChanged) {
          setIsBaking(true);
          try {
            const url = seg.url || video.url;
            if (url) {
              const trimmedUrl = await trimVideo(url, seg.trimStart, seg.duration);
              
              // Cleanup old blob URL to prevent memory leaks
              if (trimmedUrls[seg.id]) {
                URL.revokeObjectURL(trimmedUrls[seg.id]);
              }

              setTrimmedUrls(prev => ({ ...prev, [seg.id]: trimmedUrl }));
              bakedBoundsRef.current[seg.id] = { start: seg.trimStart, duration: seg.duration };
              
              // Only bake one at a time to not overwhelm the UI
              setIsBaking(false);
              break; 
            }
          } catch (err) {
            console.error("FFmpeg trim failed:", err);
            setIsBaking(false);
          }
        }
      }
    };

    bakeNextStaleSegment();
  }, [state.videoSegments, ffmpegLoaded, trimVideo, video.url]);

  // Video Source with Proxy/WASM Logic
  const videoSrc = (() => {
    // Priority: Baked WASM blob -> Asset URL -> Proxy
    if (activeSegment && trimmedUrls[activeSegment.id]) {
      return trimmedUrls[activeSegment.id];
    }

    const rawUrl = activeSegment?.url || video.previewUrl || video.url;
    if (!rawUrl) return "";
    
    if (rawUrl.startsWith("/") || rawUrl.includes("blob:") || rawUrl.includes("localhost") || rawUrl.includes("creati.in")) {
      return rawUrl;
    }

    const baseUrl = "http://localhost:8080"; 
    return `${baseUrl}/api/proxy/video?url=${encodeURIComponent(rawUrl)}`;
  })();

  const filterStyle = (() => {
    if (!activeSegment?.filter) return {};
    switch (activeSegment.filter) {
      case "noir": return { filter: "grayscale(1) contrast(1.2) brightness(0.9)" };
      case "sepia": return { filter: "sepia(1) contrast(1.1)" };
      case "vivid": return { filter: "saturate(1.8) contrast(1.1)" };
      case "cinematic": return { filter: "contrast(1.2) brightness(0.9) saturate(1.1) sepia(0.1)" };
      default: return {};
    }
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
    isBaking,
    duration: state.totalDuration,
  currentTime: state.currentTime,
    togglePlay,
    handleLoadedMetadata,
    handleTimeUpdate,
    // Segments
    activeSegment,
    videoSegments: state.videoSegments,
    addVideoSegment,
    updateVideoSegment,
    handleTrimChange,
    filterStyle,
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
