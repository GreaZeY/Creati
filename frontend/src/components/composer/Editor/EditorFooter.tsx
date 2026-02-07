import { Smile as EmojiIcon, Sparkles, Palette, ImagePlay } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorFooterProps {
  onMediaClick: () => void;
  onEmojiClick: () => void;
  onAIClick: () => void;
  onCanvaClick: () => void;
  onGiphyClick: () => void;
}

export function EditorFooter({
  onMediaClick,
  onEmojiClick,
  onAIClick,
  onCanvaClick,
  onGiphyClick,
}: EditorFooterProps) {
  return (
    <div className="h-11 border-t border-border/40 flex items-center justify-between px-3 bg-card/20">
      {/* Left: Attachments */}
      <div className="flex items-center gap-1">
        <button
          onClick={onMediaClick}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            "text-emerald-400 hover:bg-emerald-500/10",
            "transition-colors",
          )}
          title="Add media"
        >
          <ImagePlay size={16} />
        </button>
        <button
          onClick={onEmojiClick}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            "text-yellow-400 hover:bg-yellow-500/10",
            "transition-colors",
          )}
          title="Add emoji"
        >
          <EmojiIcon size={16} />
        </button>
      </div>

      {/* Right: AI Tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={onAIClick}
          className={cn(
            "h-8 px-3 rounded-lg flex items-center gap-1.5",
            "text-purple-400 hover:bg-purple-500/10",
            "transition-colors text-xs font-bold",
          )}
          title="AI Write Post"
        >
          <Sparkles size={14} />
          <span>AI</span>
        </button>
        <button
          onClick={onCanvaClick}
          className={cn(
            "h-8 px-3 rounded-lg flex items-center gap-1.5",
            "text-blue-400 hover:bg-blue-500/10",
            "transition-colors text-xs font-bold",
          )}
          title="Open Canva"
        >
          <Palette size={14} />
          <span>Canva</span>
        </button>
        <button
          onClick={onGiphyClick}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center gap-1.5",
            "text-pink-400 hover:bg-pink-500/10",
            "transition-colors text-xs font-bold",
          )}
          title="Add GIF"
        >
          <EmojiIcon size={16} />
          <span>GIF</span>
        </button>
      </div>
    </div>
  );
}
