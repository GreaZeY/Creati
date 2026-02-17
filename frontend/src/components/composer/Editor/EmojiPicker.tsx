import { lazy, Suspense } from "react";
const EmojiPickerReact = lazy(() => import("emoji-picker-react"));
import { Theme } from "emoji-picker-react";
import { Popper } from "@/components/ui/Popper";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
  anchorEl: HTMLElement | null;
}

export function EmojiPicker({
  onEmojiSelect,
  onClose,
  isOpen,
  anchorEl,
}: EmojiPickerProps) {
  if (!isOpen) return null;

  return (
    <Popper
      open={isOpen}
      anchorEl={anchorEl}
      onClickAway={onClose}
      placement="top-start"
      offset={{ x: 0, y: 12 }}
    >
      <div className="shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 bg-card border border-glass-border">
        <Suspense
          fallback={
            <div className="w-[320px] h-[400px] flex items-center justify-center bg-secondary/10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <EmojiPickerReact
            theme={Theme.DARK}
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji);
              onClose();
            }}
            width={320}
            height={400}
            lazyLoadEmojis={true}
          />
        </Suspense>
      </div>
    </Popper>
  );
}
