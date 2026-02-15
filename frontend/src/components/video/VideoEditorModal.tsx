import Moveable from "react-moveable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Play, Pause, Check } from "lucide-react";
import { TrimSlider } from "./TrimSlider";
import { ConfigPanel } from "./ConfigPanel";
import { useVideoEditor } from "./useVideoEditor";

export interface OverlayItem {
  id: string;
  type: "text" | "sticker" | "image";
  x: number;
  y: number;
  width: number;
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

export function VideoEditorModal({
  isOpen,
  onClose,
  video,
  initialSettings,
  onSave,
}: VideoEditorModalProps) {
  const editor = useVideoEditor({
    isOpen,
    initialSettings,
    videoId: video.id,
    onSave,
    onClose,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editor Studio"
      className="max-w-[90vw] w-full max-h-[90vh] !overflow-hidden"
    >
      <div className="flex h-[75vh] -m-6">
        {/* Canvas + Trim */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/20">
          <div
            ref={editor.canvasRef}
            className="flex-1 relative overflow-hidden cursor-default"
            onClick={(e) => {
              if (e.target === e.currentTarget) editor.deselectAll();
            }}
          >
            <video
              ref={editor.videoRef}
              src={video.previewUrl || video.url}
              className="w-full h-full object-contain"
              onLoadedMetadata={editor.handleLoadedMetadata}
              onTimeUpdate={editor.handleTimeUpdate}
              onEnded={() => editor.setIsPlaying(false)}
              crossOrigin="anonymous"
            />

            {/* Overlays */}
            {editor.containerSize.width > 0 &&
              editor.overlays.map((ov) => (
                <OverlayElement
                  key={ov.id}
                  overlay={ov}
                  isSelected={editor.selectedId === ov.id}
                  containerSize={editor.containerSize}
                  pctToPx={editor.pctToPx}
                  onSelect={editor.selectOverlay}
                />
              ))}

            {/* Moveable */}
            {editor.moveableTarget && editor.selectedId && (
              <MoveableController
                moveableRef={editor.moveableRef}
                target={editor.moveableTarget}
                container={editor.canvasRef.current}
                containerSize={editor.containerSize}
                selectedId={editor.selectedId}
                onUpdate={editor.updateOverlay}
              />
            )}

            {/* Play/Pause */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <button
                onClick={editor.togglePlay}
                className="p-3 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white transition-colors shadow-lg"
              >
                {editor.isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>
            </div>
          </div>

          {/* Trim + Actions */}
          <div className="p-4 bg-card/80 backdrop-blur-sm border-t border-border/30">
            <TrimSlider
              duration={editor.duration}
              start={editor.trimStart}
              end={editor.trimEnd}
              currentTime={editor.currentTime}
              onChange={editor.handleTrimChange}
            />
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border/30">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={editor.handleSave} className="gap-2">
                <Check size={14} /> Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Config Panel */}
        <ConfigPanel
          overlays={editor.overlays}
          selectedId={editor.selectedId}
          onAddText={editor.addText}
          onAddSticker={editor.addSticker}
          onAddImage={editor.addImage}
          onUpdateOverlay={editor.updateOverlay}
          onDeleteOverlay={editor.deleteOverlay}
        />
      </div>
    </Modal>
  );
}

// ── Sub-components ──

function OverlayElement({
  overlay: ov,
  isSelected,
  containerSize,
  pctToPx,
  onSelect,
}: {
  overlay: OverlayItem;
  isSelected: boolean;
  containerSize: { width: number; height: number };
  pctToPx: (pct: number, dim: number) => number;
  onSelect: (id: string) => void;
}) {
  const hasExplicitSize = ov.type === "sticker" || ov.type === "image";

  return (
    <div
      id={`overlay-${ov.id}`}
      className={`absolute cursor-move ${isSelected ? "outline outline-2 outline-primary outline-offset-2" : ""}`}
      style={{
        left: `${pctToPx(ov.x, containerSize.width)}px`,
        top: `${pctToPx(ov.y, containerSize.height)}px`,
        transform: `rotate(${ov.rotation}deg)`,
        userSelect: "none",
        ...(hasExplicitSize
          ? {
              width: `${Math.max(40, (ov.width / 100) * containerSize.width)}px`,
              height: `${Math.max(40, (ov.height / 100) * containerSize.height)}px`,
              containerType: "inline-size" as any,
            }
          : {}),
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(ov.id);
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
            borderRadius: ov.bgColor !== "transparent" ? "6px" : undefined,
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
          className="w-full h-full flex items-center justify-center select-none"
          style={{ fontSize: "70cqi", lineHeight: 1 }}
        >
          {ov.src}
        </div>
      )}

      {ov.type === "image" && ov.src && (
        <img
          src={ov.src}
          alt="overlay"
          className="w-full h-full rounded-md pointer-events-none"
          style={{ objectFit: "contain" }}
          draggable={false}
        />
      )}
    </div>
  );
}

function MoveableController({
  moveableRef,
  target,
  container,
  containerSize,
  selectedId,
  onUpdate,
}: {
  moveableRef: React.RefObject<Moveable | null>;
  target: HTMLElement;
  container: HTMLElement | null;
  containerSize: { width: number; height: number };
  selectedId: string;
  onUpdate: (id: string, updates: Partial<OverlayItem>) => void;
}) {
  return (
    <Moveable
      ref={moveableRef}
      target={target}
      container={container}
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
      onDrag={({ target: t, left, top }) => {
        t.style.left = `${left}px`;
        t.style.top = `${top}px`;
      }}
      onDragEnd={({ target: t }) => {
        if (!containerSize.width) return;
        onUpdate(selectedId, {
          x: ((parseFloat(t.style.left) || 0) / containerSize.width) * 100,
          y: ((parseFloat(t.style.top) || 0) / containerSize.height) * 100,
        });
      }}
      onResize={({ target: t, width, height, drag }) => {
        t.style.width = `${width}px`;
        t.style.height = `${height}px`;
        t.style.left = `${drag.left}px`;
        t.style.top = `${drag.top}px`;
      }}
      onResizeEnd={({ target: t }) => {
        if (!containerSize.width) return;
        const left = parseFloat(t.style.left) || 0;
        const top = parseFloat(t.style.top) || 0;
        const w = parseFloat(t.style.width) || 0;
        const h = parseFloat(t.style.height) || 0;
        onUpdate(selectedId, {
          x: (left / containerSize.width) * 100,
          y: (top / containerSize.height) * 100,
          width: (w / containerSize.width) * 100,
          height: (h / containerSize.height) * 100,
        });
      }}
      onRotate={({ target: t, rotate }) => {
        t.style.transform = `rotate(${rotate}deg)`;
      }}
      onRotateEnd={({ target: t }) => {
        const match = t.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        if (match) {
          onUpdate(selectedId, { rotation: parseFloat(match[1]) });
        }
      }}
    />
  );
}
