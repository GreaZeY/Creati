import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { countCharacters } from "@/lib/youtubeLive";

interface Props {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function LiveTagsInput({ id, value, onChange, disabled }: Props) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const characters = countCharacters(value.join(","));

  function add(text: string) {
    const next = [...value];
    for (const part of text.split(/[,\r\n]+/)) {
      const tag = part.trim();
      if (tag && !next.some(existing => existing.toLowerCase() === tag.toLowerCase())) next.push(tag);
    }
    if (next.length > 20 || countCharacters(next.join(",")) > 400) {
      setError("Use at most 20 tags, totaling at most 400 characters.");
      return;
    }
    onChange(next);
    setPending("");
    setError("");
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
    setError("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stream tags">
          {value.map((tag, index) => (
            <Chip key={`${index}:${tag}`} label={tag} icon={<X size={12} aria-hidden="true" />}
              aria-label={`Remove tag ${tag}`} disabled={disabled}
              className="h-auto min-h-8 max-w-full py-1 [&>span]:max-w-none [&>span]:whitespace-normal [&>span]:break-words"
              onClick={() => remove(index)} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input id={id} value={pending} disabled={disabled} placeholder="Add a tag…"
          aria-describedby={`${id}-hint ${id}-count${error ? ` ${id}-error` : ""}`}
          aria-invalid={Boolean(error) || value.length > 20 || characters > 400}
          onChange={e => { setPending(e.target.value); setError(""); }}
          onBlur={() => { if (pending.trim()) add(pending); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(pending); }
            if (e.key === "Backspace" && !pending && value.length) remove(value.length - 1);
          }}
          onPaste={e => {
            const text = e.clipboardData.getData("text");
            if (/[,\r\n]/.test(text)) {
              e.preventDefault();
              const start = e.currentTarget.selectionStart ?? pending.length;
              const end = e.currentTarget.selectionEnd ?? start;
              const combined = pending.slice(0, start) + text + pending.slice(end);
              setPending(combined);
              add(combined);
            }
          }} />
        <Button type="button" size="sm" variant="outline" disabled={disabled || !pending.trim()} onClick={() => add(pending)}>Add</Button>
      </div>
      <p id={`${id}-hint`} className="text-[10px] leading-relaxed text-muted-foreground">Press Enter or comma to add. Paste a list, or click a tag to remove it.</p>
      <p id={`${id}-count`} className={`text-[10px] ${value.length > 20 || characters > 400 ? "text-destructive" : "text-muted-foreground"}`}>{value.length} / 20 tags · {characters} / 400 characters</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
