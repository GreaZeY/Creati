import { useState } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export function PostTextEditor({
  value,
  onChange,
  placeholder = "What's on your mind?",
  maxLength = 2200,
  className,
}: PostTextEditorProps) {
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 100;

  // Simple hashtag highlighting via regex
  const highlightHashtags = (text: string) => {
    return text.split(/(#\w+)/g).map((part, i) =>
      part.startsWith("#") ? (
        <span key={i} className="text-primary font-bold">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={6}
          className="w-full p-4 rounded-xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none font-medium leading-relaxed placeholder:text-muted-foreground/30 ring-1 ring-border/50"
        />
      </div>

      {/* Character Counter */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground/50 uppercase tracking-wider font-bold">
          {value.length} / {maxLength}
        </span>
        {isNearLimit && (
          <span className="text-amber-500 font-bold uppercase tracking-wider">
            {remaining} left
          </span>
        )}
      </div>
    </div>
  );
}
