import { useState, useRef, useEffect, useCallback } from "react";
import Moveable from "react-moveable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Play, Pause, Check } from "lucide-react";
import { TrimSlider } from "./TrimSlider";
import { ConfigPanel } from "./ConfigPanel";

export interface OverlayItem {
  id: string;
  type: "text" | "sticker" | "image";
  x: number; // percentage 0-100
  y: number;
  width: number; // percentage for sizing
  height: number;
  rotation: number;
  text?: string;
  src?: string;
  fontSize?: number;
  fontColor: string;
  bgColor: string;
  fontFamily: string;
  preset?: string;
}

export interface ProcessingSettings {
  trim_start?: number;
  trim_end?: number;
  overlays: OverlayItem[];
}

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    url?: string;
    previewUrl?: string;
    sourcePlatform?: string;
  };
  initialSettings?: ProcessingSettings;
  onSave: (id: string, settings: ProcessingSettings) => void;
}

let overlayIdCounter = 0;
function generateId() {
  return `overlay-${Date.now()}-${++overlayIdCounter}`;
}

export function VideoEditorModal({
  isOpen,
  onClose,
  video,
  initialSettings,
  onSave,
}: VideoEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [overlays, setOverlays] = useState<OverlayItem[]>(
    initialSettings?.overlays || [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(
    null,
  );

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setSelectedId(null);
      setMoveableTarget(null);
      if (initialSettings?.overlays) {
        setOverlays(initialSettings.overlays);
      } else {
        setOverlays([]);
      }
    }
  }, [isOpen, initialSettings]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setTrimStart(initialSettings?.trim_start ?? 0);
      setTrimEnd(initialSettings?.trim_end ?? dur);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      if (curr > trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (
        videoRef.current.currentTime < trimStart ||
        videoRef.current.currentTime >= trimEnd
      ) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  };

  // Overlay CRUD
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

  const selectOverlay = (id: string) => {
    setSelectedId(id);
    const el = document.getElementById(`overlay-${id}`);
    setMoveableTarget(el);
  };

  const deselectAll = () => {
    setSelectedId(null);
    setMoveableTarget(null);
  };

  const handleSave = () => {
    onSave(video.id, {
      trim_start: trimStart,
      trim_end: trimEnd,
      overlays,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editor Studio"
      className="max-w-[90vw] w-full max-h-[90vh] !overflow-hidden"
    >
      <div className="flex h-[75vh] -m-6">
        {/* Left: Canvas + Trim */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/20">
          {/* Video Canvas */}
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-hidden cursor-default"
            onClick={(e) => {
              if (
                e.target === e.currentTarget ||
                e.target === canvasRef.current
              ) {
                deselectAll();
              }
            }}
          >
            <video
              ref={videoRef}
              src={video.previewUrl || video.url}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              crossOrigin="anonymous"
            />

            {/* Overlay Renderer */}
            <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
              {overlays.map((ov) => (
                <div
                  key={ov.id}
                  id={`overlay-${ov.id}`}
                  className={`absolute cursor-move ${
                    selectedId === ov.id
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-transparent"
                      : ""
                  }`}
                  style={{
                    left: `${ov.x}%`,
                    top: `${ov.y}%`,
                    transform: `rotate(${ov.rotation}deg)`,
                    pointerEvents: "auto",
                    userSelect: "none",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectOverlay(ov.id);
                  }}
                >
                  {ov.type === "text" && (
                    <div
                      className="px-3 py-1.5 whitespace-nowrap font-bold drop-shadow-lg"
                      style={{
                        fontSize: `${ov.fontSize || 24}px`,
                        color: ov.fontColor,
                        backgroundColor: ov.bgColor,
                        fontFamily: ov.fontFamily,
                        borderRadius:
                          ov.bgColor !== "transparent" ? "6px" : undefined,
                        textShadow:
                          ov.bgColor === "transparent"
                            ? "0 2px 8px rgba(0,0,0,0.8)"
                            : undefined,
                      }}
                    >
                      {ov.text || "Text"}
                    </div>
                  )}

                  {ov.type === "sticker" && (
                    <div
                      style={{
                        fontSize: `${Math.max(20, (ov.width / 100) * 300)}px`,
                        lineHeight: 1,
                      }}
                    >
                      {ov.src}
                    </div>
                  )}

                  {ov.type === "image" && ov.src && (
                    <img
                      src={ov.src}
                      alt="overlay"
                      className="max-w-none rounded-md"
                      style={{
                        width: `${Math.max(40, (ov.width / 100) * 500)}px`,
                        height: "auto",
                      }}
                      draggable={false}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Moveable for selected overlay */}
            {moveableTarget && selectedId && (
              <Moveable
                target={moveableTarget}
                container={canvasRef.current}
                draggable
                resizable
                rotatable
                throttleDrag={1}
                throttleResize={1}
                throttleRotate={1}
                renderDirections={["nw", "ne", "sw", "se"]}
                rotationPosition="top"
                origin={false}
                padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
                onDrag={({ target, left, top }) => {
                  target.style.left = `${left}px`;
                  target.style.top = `${top}px`;
                }}
                onDragEnd={({ target }) => {
                  if (!canvasRef.current || !selectedId) return;
                  const containerRect =
                    canvasRef.current.getBoundingClientRect();
                  const x =
                    (parseFloat(target.style.left) / containerRect.width) * 100;
                  const y =
                    (parseFloat(target.style.top) / containerRect.height) * 100;
                  updateOverlay(selectedId, { x, y });
                }}
                onResize={({ target, width, height, drag }) => {
                  target.style.width = `${width}px`;
                  target.style.height = `${height}px`;
                  target.style.left = `${drag.left}px`;
                  target.style.top = `${drag.top}px`;
                }}
                onResizeEnd={({ target }) => {
                  if (!canvasRef.current || !selectedId) return;
                  const containerRect =
                    canvasRef.current.getBoundingClientRect();
                  const w =
                    (parseFloat(target.style.width) / containerRect.width) *
                    100;
                  const h =
                    (parseFloat(target.style.height) / containerRect.height) *
                    100;
                  const x =
                    (parseFloat(target.style.left) / containerRect.width) * 100;
                  const y =
                    (parseFloat(target.style.top) / containerRect.height) * 100;
                  updateOverlay(selectedId, {
                    width: w,
                    height: h,
                    x,
                    y,
                  });
                }}
                onRotate={({ target, rotate }) => {
                  target.style.transform = `rotate(${rotate}deg)`;
                }}
                onRotateEnd={({ target }) => {
                  if (!selectedId) return;
                  const match = target.style.transform.match(
                    /rotate\(([-\d.]+)deg\)/,
                  );
                  if (match) {
                    updateOverlay(selectedId, {
                      rotation: parseFloat(match[1]),
                    });
                  }
                }}
              />
            )}

            {/* Play/Pause Button */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
              <button
                onClick={togglePlay}
                className="p-3 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white transition-colors shadow-lg"
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>
            </div>
          </div>

          {/* Trim Slider */}
          <div className="p-4 bg-card/80 backdrop-blur-sm border-t border-border/30">
            <TrimSlider
              duration={duration}
              start={trimStart}
              end={trimEnd}
              currentTime={currentTime}
              onChange={handleTrimChange}
            />

            {/* Save/Cancel */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border/30">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-2">
                <Check size={14} /> Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Config Panel */}
        <ConfigPanel
          overlays={overlays}
          selectedId={selectedId}
          onAddText={addText}
          onAddSticker={addSticker}
          onAddImage={addImage}
          onUpdateOverlay={updateOverlay}
          onDeleteOverlay={deleteOverlay}
        />
      </div>
    </Modal>
  );
}
