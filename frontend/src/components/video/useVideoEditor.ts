import { useState, useRef, useEffect, useCallback } from "react";
import type Moveable from "react-moveable";
import type { OverlayItem, ProcessingSettings } from "./VideoEditorModal";

let overlayIdCounter = 0;
function generateId() {
  return `overlay-${Date.now()}-${++overlayIdCounter}`;
}

interface UseVideoEditorArgs {
  isOpen: boolean;
  initialSettings?: ProcessingSettings;
  videoId: string;
  onSave: (id: string, settings: ProcessingSettings) => void;
  onClose: () => void;
}

export function useVideoEditor({
  isOpen,
  initialSettings,
  videoId,
  onSave,
  onClose,
}: UseVideoEditorArgs) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Overlays
  const [overlays, setOverlays] = useState<OverlayItem[]>(
    initialSettings?.overlays || [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    if (isOpen) {
      setIsPlaying(false);
      setSelectedId(null);
      setMoveableTarget(null);
      setOverlays(initialSettings?.overlays || []);
    }
  }, [isOpen, initialSettings]);

  useEffect(() => {
    if (selectedId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`overlay-${selectedId}`);
        setMoveableTarget(el || null);
      });
    } else {
      setMoveableTarget(null);
    }
  }, [selectedId]);

  const selected = overlays.find((o) => o.id === selectedId);
  useEffect(() => {
    if (moveableRef.current && selectedId) {
      requestAnimationFrame(() => {
        moveableRef.current?.updateRect();
      });
    }
  }, [
    selectedId,
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
      setDuration(dur);
      setTrimStart(initialSettings?.trim_start ?? 0);
      setTrimEnd(initialSettings?.trim_end ?? dur);
    }
  }, [initialSettings]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      if (trimEnd > 0 && curr > trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
    }
  }, [trimStart, trimEnd]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (
        trimEnd > 0 &&
        (videoRef.current.currentTime < trimStart ||
          videoRef.current.currentTime >= trimEnd)
      ) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, trimStart, trimEnd]);

  const handleTrimChange = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

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
    setOverlays((prev) => [...prev, item]);
    setSelectedId(item.id);
  }, []);

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
    setOverlays((prev) => [...prev, item]);
    setSelectedId(item.id);
  }, []);

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
    setOverlays((prev) => [...prev, item]);
    setSelectedId(item.id);
  }, []);

  const updateOverlay = useCallback(
    (id: string, updates: Partial<OverlayItem>) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      );
    },
    [],
  );

  const deleteOverlay = useCallback(
    (id: string) => {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setMoveableTarget(null);
      }
    },
    [selectedId],
  );

  const selectOverlay = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedId(null);
    setMoveableTarget(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave(videoId, {
      trim_start: trimStart,
      trim_end: trimEnd,
      overlays,
    });
    onClose();
  }, [videoId, trimStart, trimEnd, overlays, onSave, onClose]);

  const pctToPx = useCallback(
    (pct: number, dimension: number) => (pct / 100) * dimension,
    [],
  );

  return {
    // Refs
    videoRef,
    canvasRef,
    moveableRef,
    // Playback
    isPlaying,
    setIsPlaying,
    duration,
    currentTime,
    togglePlay,
    handleLoadedMetadata,
    handleTimeUpdate,
    // Trim
    trimStart,
    trimEnd,
    handleTrimChange,
    // Overlays
    overlays,
    selectedId,
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
