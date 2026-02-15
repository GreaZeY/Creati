import { useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Type, Smile, ImagePlus, Trash2, RotateCcw } from "lucide-react";
import type { OverlayItem } from "./VideoEditorModal";

interface ConfigPanelProps {
  overlays: OverlayItem[];
  selectedId: string | null;
  onAddText: () => void;
  onAddSticker: (emoji: string) => void;
  onAddImage: (dataUrl: string) => void;
  onUpdateOverlay: (id: string, updates: Partial<OverlayItem>) => void;
  onDeleteOverlay: (id: string) => void;
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

export function ConfigPanel({
  overlays,
  selectedId,
  onAddText,
  onAddSticker,
  onAddImage,
  onUpdateOverlay,
  onDeleteOverlay,
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = overlays.find((o) => o.id === selectedId) || null;

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

  return (
    <div className="w-72 flex-shrink-0 bg-secondary/10 border-l border-border/40 flex flex-col overflow-hidden">
      {/* Add Actions */}
      <div className="p-4 border-b border-border/30 space-y-3">
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
          Add Element
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onAddText}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Type size={20} />
            <span className="text-[10px] font-bold uppercase">Text</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ImagePlus size={20} />
            <span className="text-[10px] font-bold uppercase">Image</span>
          </button>
          <button
            onClick={() => {}} // Sticker section below handles this
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground opacity-50 cursor-default"
            title="Use sticker grid below"
          >
            <Smile size={20} />
            <span className="text-[10px] font-bold uppercase">Sticker</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Sticker Grid */}
      <div className="p-4 border-b border-border/30">
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">
          Stickers
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {STICKER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onAddSticker(emoji)}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-secondary/50 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Overlay Config */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <div className="space-y-4">
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
                  onClick={() => onUpdateOverlay(selected.id, { rotation: 0 })}
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
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Content
                  </label>
                  <Input
                    value={selected.text || ""}
                    onChange={(e) =>
                      onUpdateOverlay(selected.id, { text: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Size: {selected.fontSize || 24}px
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={80}
                    value={selected.fontSize || 24}
                    onChange={(e) =>
                      onUpdateOverlay(selected.id, {
                        fontSize: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Font Color */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
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
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
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
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1.5">
                    Preset Styles
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
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
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Scale: {selected.width.toFixed(2)}%
                </label>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={0.5}
                  value={selected.width}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateOverlay(selected.id, {
                      width: val,
                      height: val,
                    });
                  }}
                  className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            {/* Rotation display */}
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                Rotation: {Math.round(selected.rotation)}°
              </label>
              <input
                type="range"
                min={-180}
                max={180}
                value={selected.rotation}
                onChange={(e) =>
                  onUpdateOverlay(selected.id, {
                    rotation: parseInt(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center mb-3">
              <Type size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60">
              Select an element to edit
            </p>
            <p className="text-xs text-muted-foreground/40 mt-1">
              or add a new one above
            </p>
          </div>
        )}
      </div>

      {/* Overlay List */}
      {overlays.length > 0 && (
        <div className="p-4 border-t border-border/30">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">
            Layers ({overlays.length})
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {overlays.map((ov) => (
              <div
                key={ov.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                  ov.id === selectedId
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary/30 text-muted-foreground"
                }`}
              >
                <span className="truncate flex-1">
                  {ov.type === "text"
                    ? ov.text || "Text"
                    : ov.type === "sticker"
                      ? ov.src
                      : "Image"}
                </span>
                <span className="text-[10px] uppercase opacity-50">
                  {ov.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
