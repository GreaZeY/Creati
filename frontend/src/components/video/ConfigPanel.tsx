import { useRef, useState, useEffect } from "react";
import { Type, ImagePlus, Trash2, RotateCcw } from "lucide-react";
import type { OverlayItem } from "./VideoEditorModal";
import { Textarea } from "@/components/ui/Textarea";
import { Slider } from "@/components/ui/Slider";
import { Dropdown } from "@/components/ui/Dropdown";
import { TransitionGallery } from "./TransitionGallery";
import { FilterGallery } from "./FilterGallery";
import { useStudio } from "../../context/StudioProvider";

interface ConfigPanelProps {
  overlays: OverlayItem[];
  selectedId: string | null;
  onAddText: () => void;
  onAddSticker: (emoji: string) => void;
  onAddImage: (dataUrl: string) => void;
  onUpdateOverlay: (id: string, updates: Partial<OverlayItem>) => void;
  onDeleteOverlay: (id: string) => void;
  onSelectOverlay: (id: string) => void;
}

const COLOR_SWATCHES = [
  "#ffffff",
  "#000000",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#007aff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#a2845e",
  "#8e8e93",
];

const STICKER_EMOJIS = [
  "🔥",
  "💯",
  "⭐",
  "❤️",
  "😂",
  "🎉",
  "👑",
  "💎",
  "🚀",
  "✨",
  "🎯",
  "💪",
  "🌟",
  "👀",
  "🤩",
  "💥",
  "🎬",
  "📸",
  "🎵",
  "🌈",
  "⚡",
  "🏆",
  "💫",
  "🎭",
];

const TEXT_PRESETS = [
  {
    name: "Classic",
    fontColor: "#ffffff",
    bgColor: "transparent",
    fontFamily: "sans-serif",
    fontSize: 32,
  },
  {
    name: "Bold Shadow",
    fontColor: "#ffffff",
    bgColor: "rgba(0,0,0,0.7)",
    fontFamily: "sans-serif",
    fontSize: 36,
  },
  {
    name: "Neon",
    fontColor: "#00ff88",
    bgColor: "transparent",
    fontFamily: "monospace",
    fontSize: 30,
  },
  {
    name: "Retro",
    fontColor: "#ffcc00",
    bgColor: "rgba(0,0,0,0.5)",
    fontFamily: "serif",
    fontSize: 34,
  },
  {
    name: "Minimal",
    fontColor: "#f5f5f5",
    bgColor: "transparent",
    fontFamily: "sans-serif",
    fontSize: 24,
  },
  {
    name: "Pop",
    fontColor: "#ff2d55",
    bgColor: "rgba(255,255,255,0.9)",
    fontFamily: "sans-serif",
    fontSize: 32,
  },
];

const FONT_OPTIONS = [
  { id: "sans-serif", label: "Sans Serif", value: "sans-serif" },
  { id: "serif", label: "Serif", value: "serif" },
  { id: "monospace", label: "Monospace", value: "monospace" },
  { id: "'Inter', sans-serif", label: "Inter", value: "'Inter', sans-serif" },
  { id: "'Georgia', serif", label: "Georgia", value: "'Georgia', serif" },
  {
    id: "'Courier New', monospace",
    label: "Courier New",
    value: "'Courier New', monospace",
  },
  {
    id: "'Impact', sans-serif",
    label: "Impact",
    value: "'Impact', sans-serif",
  },
  {
    id: "'Comic Sans MS', cursive",
    label: "Comic Sans",
    value: "'Comic Sans MS', cursive",
  },
  { id: "cursive", label: "Cursive", value: "cursive" },
  { id: "system-ui", label: "System UI", value: "system-ui" },
];

export function ConfigPanel({
  overlays,
  selectedId,
  onAddText,
  onAddSticker,
  onAddImage,
  onUpdateOverlay,
  onDeleteOverlay,
  onSelectOverlay,
}: ConfigPanelProps) {
  const { state, addVideoSegment, updateVideoSegment, removeVideoSegment } =
    useStudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"add" | "edit">(
    selectedId ? "edit" : "add",
  );

  const selected = overlays.find((o) => o.id === selectedId) || null;

  useEffect(() => {
    if (selectedId) setActiveTab("edit");
  }, [selectedId]);

  // Active segment for contextual editing
  const activeSegment =
    state.videoSegments.find(
      (seg) =>
        state.currentTime >= seg.startTime &&
        state.currentTime < seg.startTime + seg.duration,
    ) || state.videoSegments[0];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAddImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddClip = () => {
    if (activeSegment) {
      const { id: _id, startTime: _startTime, ...blueprint } = activeSegment;
      addVideoSegment({
        ...blueprint,
      });
    }
  };

  return (
    <div className="w-80 flex-shrink-0 bg-secondary/10 border-l border-border/40 flex flex-col overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex border-b border-border/30">
        <button
          onClick={() => setActiveTab("add")}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === "add"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
          }`}
        >
          Add
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === "edit"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
          }`}
        >
          Edit
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "add" ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Add Actions */}
            <div className="p-4 border-b border-border/30 space-y-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                Elements
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onAddText}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/30 hover:bg-primary/20 border border-border/20 hover:border-primary/40 transition-all text-muted-foreground hover:text-primary"
                >
                  <Type size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Text
                  </span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/30 hover:bg-primary/20 border border-border/20 hover:border-primary/40 transition-all text-muted-foreground hover:text-primary"
                >
                  <ImagePlus size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Image
                  </span>
                </button>
              </div>
            </div>

            {/* Stickers */}
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-4">
                Stickers
              </p>
              <div className="grid grid-cols-5 gap-2">
                {STICKER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onAddSticker(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-white/10 hover:scale-110 transition-all border border-border/5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Segment */}
            <div className="p-4 border-t border-border/20">
              <button
                onClick={handleAddClip}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 border border-white/10"
              >
                Duplicate active clip
              </button>
              <p className="text-[8px] text-center text-muted-foreground/40 mt-3 font-bold uppercase tracking-widest">
                Multiple video segments supported
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {selected ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    {selected.type === "text"
                      ? "Text"
                      : selected.type === "sticker"
                        ? "Sticker"
                        : "Image"}{" "}
                    Properties
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        onUpdateOverlay(selected.id, { rotation: 0 })
                      }
                      className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground"
                      title="Reset rotation"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteOverlay(selected.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Text Content */}
                {selected.type === "text" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Content
                      </label>
                      <Textarea
                        value={selected.text || ""}
                        onChange={(e) =>
                          onUpdateOverlay(selected.id, { text: e.target.value })
                        }
                        rows={2}
                        className="bg-secondary/30"
                      />
                    </div>

                    {/* Font Family */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Font
                      </label>
                      <Dropdown
                        id="font-family"
                        items={FONT_OPTIONS}
                        value={selected.fontFamily}
                        onChange={(item) =>
                          onUpdateOverlay(selected.id, {
                            fontFamily: item.value,
                          })
                        }
                        placeholder="Select Font"
                        className="w-full"
                      />
                    </div>

                    {/* Font Size */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">
                          Size
                        </label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {selected.fontSize || 24}px
                        </span>
                      </div>
                      <Slider
                        min={12}
                        max={120}
                        value={selected.fontSize || 24}
                        onValueChange={(val) =>
                          onUpdateOverlay(selected.id, { fontSize: val })
                        }
                      />
                    </div>

                    {/* Font Color */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Font Color
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            onClick={() =>
                              onUpdateOverlay(selected.id, { fontColor: color })
                            }
                            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              backgroundColor: color,
                              borderColor:
                                selected.fontColor === color
                                  ? "hsl(var(--primary))"
                                  : "transparent",
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Background Color */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Background
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() =>
                            onUpdateOverlay(selected.id, {
                              bgColor: "transparent",
                            })
                          }
                          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 bg-transparent relative overflow-hidden"
                          style={{
                            borderColor:
                              selected.bgColor === "transparent"
                                ? "hsl(var(--primary))"
                                : "hsl(var(--border))",
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-destructive text-xs font-bold">
                            ∅
                          </div>
                        </button>
                        {COLOR_SWATCHES.slice(0, 8).map((color) => (
                          <button
                            key={`bg-${color}`}
                            onClick={() =>
                              onUpdateOverlay(selected.id, {
                                bgColor: color + "cc",
                              })
                            }
                            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              backgroundColor: color + "cc",
                              borderColor:
                                selected.bgColor === color + "cc"
                                  ? "hsl(var(--primary))"
                                  : "transparent",
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preset Styles */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Preset Styles
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {TEXT_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() =>
                              onUpdateOverlay(selected.id, {
                                fontColor: preset.fontColor,
                                bgColor: preset.bgColor,
                                fontFamily: preset.fontFamily,
                                fontSize: preset.fontSize,
                                preset: preset.name,
                              })
                            }
                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                            style={{
                              color: preset.fontColor,
                              backgroundColor:
                                preset.bgColor === "transparent"
                                  ? "hsl(var(--secondary))"
                                  : preset.bgColor,
                              fontFamily: preset.fontFamily,
                              borderColor:
                                selected.preset === preset.name
                                  ? "hsl(var(--primary))"
                                  : "hsl(var(--border) / 0.3)",
                            }}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Image/Sticker Size */}
                {(selected.type === "image" || selected.type === "sticker") && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">
                        Scale
                      </label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {selected.width.toFixed(1)}%
                      </span>
                    </div>
                    <Slider
                      min={5}
                      max={80}
                      step={0.5}
                      value={selected.width}
                      onValueChange={(val) =>
                        onUpdateOverlay(selected.id, {
                          width: val,
                          height: val,
                        })
                      }
                    />
                  </div>
                )}

                {/* Animations */}
                <div className="pt-4 border-t border-border/20 space-y-4">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                    Animations
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        In
                      </label>
                      <Dropdown
                        id="anim-in"
                        items={[
                          { id: "none", label: "None", value: "none" },
                          { id: "fade", label: "Fade", value: "fade" },
                          {
                            id: "slide-up",
                            label: "Slide Up",
                            value: "slide-up",
                          },
                          { id: "zoom-in", label: "Zoom In", value: "zoom-in" },
                        ]}
                        value={selected.animationIn || "none"}
                        onChange={(item) =>
                          onUpdateOverlay(selected.id, {
                            animationIn: item.value as any,
                          })
                        }
                        placeholder="In"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">
                        Out
                      </label>
                      <Dropdown
                        id="anim-out"
                        items={[
                          { id: "none", label: "None", value: "none" },
                          { id: "fade", label: "Fade", value: "fade" },
                          {
                            id: "slide-down",
                            label: "Slide Down",
                            value: "slide-down",
                          },
                          {
                            id: "zoom-out",
                            label: "Zoom Out",
                            value: "zoom-out",
                          },
                        ]}
                        value={selected.animationOut || "none"}
                        onChange={(item) =>
                          onUpdateOverlay(selected.id, {
                            animationOut: item.value as any,
                          })
                        }
                        placeholder="Out"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">
                        Duration
                      </label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {(selected.animationDuration || 0.5).toFixed(1)}s
                      </span>
                    </div>
                    <Slider
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      value={selected.animationDuration || 0.5}
                      onValueChange={(val) =>
                        onUpdateOverlay(selected.id, { animationDuration: val })
                      }
                    />
                  </div>
                </div>

                {/* Rotation display */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Rotation
                    </label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {Math.round(selected.rotation)}°
                    </span>
                  </div>
                  <Slider
                    min={-180}
                    max={180}
                    value={selected.rotation}
                    onValueChange={(val) =>
                      onUpdateOverlay(selected.id, { rotation: val })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8 h-full">
                {/* Active Clip Management */}
                {activeSegment && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                        Clip Properties
                      </p>
                      {state.videoSegments.length > 1 && (
                        <button
                          onClick={() => removeVideoSegment(activeSegment.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                          title="Delete Clip"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Clip Volume */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">
                          Clip Volume
                        </label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {Math.round((activeSegment.volume || 1) * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={activeSegment.volume || 1}
                        onValueChange={(val) =>
                          updateVideoSegment(activeSegment.id, { volume: val })
                        }
                      />
                    </div>

                    {/* Clip Trim */}
                    <div className="space-y-3 pt-4 border-t border-border/10">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">
                          Trim Range
                        </label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {activeSegment.trimStart.toFixed(1)}s -{" "}
                          {(
                            activeSegment.trimStart + activeSegment.duration
                          ).toFixed(1)}
                          s
                        </span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground/50 tracking-widest">
                            <span>Start</span>
                            <span>{activeSegment.trimStart.toFixed(2)}s</span>
                          </div>
                          <Slider
                            min={0}
                            max={
                              activeSegment.trimStart +
                              activeSegment.duration -
                              0.1
                            }
                            step={0.1}
                            value={activeSegment.trimStart}
                            onValueChange={(val) => {
                              const delta = val - activeSegment.trimStart;
                              updateVideoSegment(activeSegment.id, {
                                trimStart: val,
                                duration: activeSegment.duration - delta,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground/50 tracking-widest">
                            <span>End</span>
                            <span>
                              {(
                                activeSegment.trimStart + activeSegment.duration
                              ).toFixed(2)}
                              s
                            </span>
                          </div>
                          <Slider
                            min={activeSegment.trimStart + 0.1}
                            max={300} // Assuming a reasonable max project length
                            step={0.1}
                            value={
                              activeSegment.trimStart + activeSegment.duration
                            }
                            onValueChange={(val) => {
                              updateVideoSegment(activeSegment.id, {
                                duration: val - activeSegment.trimStart,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cinematic Filters */}
                    <div className="space-y-4 pt-4 border-t border-border/10">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                        Cinematic Filters
                      </p>
                      <FilterGallery />
                    </div>
                  </div>
                )}

                <div className="w-full border-t border-border/20 pt-6">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-4">
                    Global Transitions
                  </p>
                  <TransitionGallery />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Overlay List */}
      {overlays.length > 0 && (
        <div className="p-4 border-t border-border/30 bg-black/10">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-4">
            Layers
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {overlays.map((ov) => (
              <div
                key={ov.id}
                onClick={() => {
                  onSelectOverlay(ov.id);
                  setActiveTab("edit");
                }}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                  ov.id === selectedId
                    ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/5"
                    : "bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${ov.id === selectedId ? "bg-primary" : "bg-muted-foreground/30"}`}
                />
                <span className="truncate flex-1 font-bold uppercase tracking-wider">
                  {ov.type === "text"
                    ? ov.text || "Text"
                    : ov.type === "sticker"
                      ? ov.src
                      : "Image"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOverlay(ov.id);
                  }}
                  className="p-1 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
