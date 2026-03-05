import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Play, Pause, Download } from "lucide-react";
import { ConfigPanel } from "./ConfigPanel";
import { useVideoEditor } from "./useVideoEditor";
import { MoveableController } from "./MoveableController";
import { OverlayElement } from "./OverlayElement";
import { StudioProvider } from "../../context/StudioProvider";
import { AssetSidebar } from "./AssetSidebar";
import { TimelineView } from "./TimelineView";

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
  animationIn?: "fade" | "slide-up" | "zoom-in" | "none";
  animationOut?: "fade" | "slide-down" | "zoom-out" | "none";
  animationDuration?: number;
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

export function VideoEditorModal(props: VideoEditorModalProps) {
  if (!props.isOpen) return null;

  return (
    <StudioProvider
      initialVideo={{
        id: props.video.id,
        url: props.video.url || "",
        duration: 0,
      }}
    >
      <VideoEditorContent {...props} />
    </StudioProvider>
  );
}

function VideoEditorContent({
  isOpen,
  onClose,
  video,
  initialSettings,
  onSave,
}: VideoEditorModalProps) {
  const editor = useVideoEditor({
    isOpen,
    initialSettings,
    video,
    onSave,
    onClose,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Creative Studio"
      className="max-w-[95vw] w-full max-h-[95vh] !overflow-hidden p-0"
    >
      <div className="flex flex-col h-[85vh]">
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Asset Library */}
          <AssetSidebar />

          {/* Center: Canvas Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-secondary/5 relative group">
            <div
              ref={editor.canvasRef}
              className="flex-1 relative overflow-hidden cursor-default flex items-center justify-center p-8"
              onClick={(e) => {
                if (e.target === e.currentTarget) editor.deselectAll();
              }}
            >
              <div className="relative shadow-2xl rounded-lg overflow-hidden bg-black max-h-full aspect-[9/16]">
                <video
                  ref={editor.videoRef}
                  src={editor.videoSrc}
                  className="w-full h-full object-contain transition-all duration-300 ease-in-out"
                  style={editor.filterStyle}
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
                {/* Baking Overlay */}
                {editor.isBaking && (
                  <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <div className="flex flex-col items-center text-center">
                      <span className="text-white font-bold tracking-wider text-sm uppercase">
                        Processing High-Fidelity Preview
                      </span>
                      <span className="text-white/60 text-xs">
                        Generating the frame-accurate cut...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Float Controls */}
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={editor.togglePlay}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  {editor.isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" />
                  )}
                </button>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-xs font-mono text-white/60">
                  {Math.floor(editor.currentTime)}s /{" "}
                  {Math.floor(editor.duration)}s
                </span>
              </div>
            </div>
          </div>

          {/* Right: Property Inspector */}
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

        {/* Bottom: Timeline & Export Bar */}
        <div className="flex flex-col bg-background border-t border-border/40">
          <TimelineView />

          <div className="h-16 px-6 flex items-center justify-between border-t border-border/20 bg-secondary/5">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-40">
                Creative Lab Alpha
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="font-bold uppercase tracking-wider text-[10px]"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={editor.handleSave}
                className="gap-2 bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider text-[10px]"
              >
                <Download size={14} /> Render & Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
