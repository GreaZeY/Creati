import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { aiAPI } from "@/lib/api";
import { toast } from "@/lib/events";
import { cn } from "@/lib/utils";

interface AIWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  currentText?: string;
}

const TONES = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "friendly", label: "Friendly", emoji: "🤝" },
  { value: "witty", label: "Witty", emoji: "😄" },
  { value: "inspirational", label: "Inspirational", emoji: "✨" },
];

export function AIWriteModal({
  isOpen,
  onClose,
  onInsert,
  currentText,
}: AIWriteModalProps) {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const isRewrite = !!currentText;

  const handleGenerate = async () => {
    if (!prompt.trim() && !isRewrite) {
      toast.error("Please enter a topic or idea");
      return;
    }

    setIsGenerating(true);
    try {
      if (isRewrite) {
        // Rewrite existing text
        const response = await aiAPI.rewrite({
          originalText: currentText!,
          platform: "general",
          tone,
        });
        setGeneratedText(response.data.data.text);
        setCredits(response.data.data.creditsRemaining);
      } else {
        // Generate new text
        const response = await aiAPI.generate({
          topic: prompt,
          tone,
          goal: "engagement",
          platform: "general",
        });
        setGeneratedText(response.data.data.text);
        setCredits(response.data.data.creditsRemaining);
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || "Failed to generate text";
      toast.error(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (generatedText) {
      onInsert(generatedText);
      onClose();
      // Reset state
      setPrompt("");
      setGeneratedText("");
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setPrompt("");
      setGeneratedText("");
      setTone("professional");
    }, 200);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Writer">
      <div className="p-6 w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            {isRewrite ? "Rewrite with AI" : "AI Content Generator"}
          </h2>
          {credits !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              {credits} credits remaining
            </p>
          )}
        </div>

        {/* Prompt Input (only for new generation) */}
        {!isRewrite && (
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Topic or Idea
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Tips for productivity, New product launch..."
              className="w-full h-20 px-3 py-2 rounded-lg border border-border/40 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Tone Selector */}
        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Tone
          </label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-bold transition-colors",
                  tone === t.value
                    ? "bg-primary/10 text-primary border border-primary/40"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-transparent",
                )}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || (!prompt.trim() && !isRewrite)}
          className="w-full mb-4 h-9"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} className="mr-2" />
              {isRewrite ? "Rewrite" : "Generate"}
            </>
          )}
        </Button>

        {/* Generated Text */}
        {generatedText && (
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Generated Text
            </label>
            <div className="p-3 rounded-lg border border-border/40 bg-accent/5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {generatedText}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1 h-9">
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!generatedText}
            className="flex-1 h-9"
          >
            Insert
          </Button>
        </div>
      </div>
    </Modal>
  );
}
