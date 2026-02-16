import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Play, Pause, Check } from "lucide-react";
import { TrimSlider } from "./TrimSlider";
import { ConfigPanel } from "./ConfigPanel";
import { useVideoEditor } from "./useVideoEditor";
import { MoveableController } from "./MoveableController";
import { OverlayElement } from "./OverlayElement";

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
    video, // Pass full video object
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
              src={editor.videoSrc}
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
          onSelectOverlay={editor.selectOverlay}
        />
      </div>
    </Modal>
  );
}
