import React, { useState, useEffect } from "react";
import { Music, Smile, Search, Play, Pause, Plus } from "lucide-react";
import { mediaAPI } from "../../lib/api";
import { useStudio } from "../../context/StudioProvider";

export const AssetSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"audio" | "stickers">("audio");
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { addAudioTrack, addOverlay } = useStudio();

  useEffect(() => {
    loadAssets();
  }, [activeTab]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const resp = await mediaAPI.listAssets(activeTab);
      if (resp.data.success) {
        setAssets(resp.data.data);
      }
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (asset: any) => {
    if (previewingId === asset.id) {
      audioRef.current?.pause();
      setPreviewingId(null);
    } else {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = asset.url;
      audioRef.current.play();
      setPreviewingId(asset.id);
      audioRef.current.onended = () => setPreviewingId(null);
    }
  };

  const handleAdd = (asset: any) => {
    if (asset.type === "audio") {
      addAudioTrack({
        name: asset.name,
        url: asset.url,
        startTime: 0,
        duration: asset.metadata?.duration || 30,
        volume: 0.5,
        fadeIn: 0,
        fadeOut: 0,
      });
    } else if (asset.type === "sticker") {
      addOverlay({
        id: `sticker-${Date.now()}`,
        type: "sticker",
        x: 40,
        y: 40,
        width: 20,
        height: 20,
        rotation: 0,
        src: asset.url,
        fontColor: "#ffffff",
        bgColor: "transparent",
        fontFamily: "sans-serif",
      });
    }
  };

  return (
    <div className="w-64 flex-shrink-0 bg-secondary/10 border-r border-border/40 flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-border/30">
        <button
          onClick={() => setActiveTab("audio")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${activeTab === "audio" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-secondary/30"}`}
        >
          <Music size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Music
          </span>
        </button>
        <button
          onClick={() => setActiveTab("stickers")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${activeTab === "stickers" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-secondary/30"}`}
        >
          <Smile size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Graphics
          </span>
        </button>
      </div>

      <div className="p-3 border-b border-border/20">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
          />
          <input
            type="text"
            placeholder="Search library..."
            className="w-full bg-secondary/30 border-none rounded-md pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-2 opacity-40">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Studying Library...
            </span>
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative bg-secondary/20 hover:bg-secondary/40 border border-border/20 rounded-lg p-2 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-black/20 flex items-center justify-center overflow-hidden">
                  {asset.type === "audio" ? (
                    <Music size={16} className="text-primary/60" />
                  ) : (
                    <img
                      src={asset.url}
                      className="object-contain w-full h-full"
                      alt={asset.name}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate pr-6">
                    {asset.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    {asset.type === "audio"
                      ? `${Math.floor(asset.metadata?.duration || 0)}s`
                      : asset.tags?.[0] || "Graphic"}
                  </p>
                </div>
              </div>

              <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {asset.type === "audio" && (
                  <button
                    onClick={() => handlePreview(asset)}
                    className="p-1 rounded bg-black/40 hover:bg-black/60 text-white transition-colors"
                  >
                    {previewingId === asset.id ? (
                      <Pause size={12} fill="currentColor" />
                    ) : (
                      <Play size={12} fill="currentColor" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleAdd(asset)}
                  className="p-1 rounded bg-primary text-primary-foreground hover:scale-105 transition-transform"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Use ref for audio preview to avoid re-renders resetting it
import { useRef } from "react";
