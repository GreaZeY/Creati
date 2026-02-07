import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

interface SocialTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export interface SocialTextAreaHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

export const SocialTextArea = forwardRef<
  SocialTextAreaHandle,
  SocialTextAreaProps
>(
  (
    { value, onChange, placeholder = "What's on your mind?", maxLength = 280 },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + text + value.substring(end);

        onChange(newValue);

        // Reset cursor position after React update
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      },
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [value]);

    const charactersLeft = maxLength - value.length;
    const isOverLimit = charactersLeft < 0;

    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full resize-none border-none bg-transparent",
            "text-sm leading-relaxed",
            "placeholder:text-muted-foreground/40",
            "focus:outline-none",
            "min-h-[120px] max-h-[400px]",
            "p-0",
          )}
          rows={1}
        />

        {/* Character Counter */}
        <div
          className={cn(
            "absolute bottom-2 right-2 text-[10px] font-bold tabular-nums",
            isOverLimit ? "text-red-500" : "text-muted-foreground/40",
          )}
        >
          {charactersLeft < 50 && charactersLeft}
        </div>
      </div>
    );
  },
);

SocialTextArea.displayName = "SocialTextArea";
