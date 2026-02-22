import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Sparkles, CheckCircle2, X, TrendingUp, Clock } from "lucide-react";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { cn } from "@/lib/utils";
import {
  useEvergreenSuggestions,
  type SuggestedPost,
} from "@/hooks/useEvergreenSuggestions";

function ScorePill({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const heat =
    pct >= 80
      ? "text-amber-400"
      : pct >= 50
        ? "text-cyan-400"
        : "text-muted-foreground";
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest",
        heat,
      )}
    >
      <TrendingUp size={9} />
      {pct}
    </span>
  );
}

function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
}: {
  suggestion: SuggestedPost;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="group p-3 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-primary/30 hover:bg-primary/5 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <PlatformLogo
            platform={suggestion.platform}
            size={12}
            className="text-primary shrink-0"
          />
          <p className="text-[10px] font-black tracking-tight truncate leading-tight">
            {suggestion.title}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-rose-400"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScorePill score={suggestion.recycleScore} />
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Clock size={9} />
            {format(new Date(suggestion.scheduledFor), "MMM d")}
          </span>
        </div>
        <button
          onClick={onApprove}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary hover:text-white bg-primary/10 hover:bg-primary px-2 py-1 rounded-lg transition-all"
          aria-label="Approve and schedule"
        >
          <CheckCircle2 size={9} />
          Boost
        </button>
      </div>
    </motion.div>
  );
}

export function SuggestionBar() {
  const { suggestions, isLoading, approve, dismiss } =
    useEvergreenSuggestions();

  if (isLoading || suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Sparkles size={12} className="text-amber-400" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
          Evergreen Suggestions
        </h4>
        <span className="ml-auto text-[9px] font-bold text-muted-foreground">
          {suggestions.length} ready to recycle
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onApprove={() => approve(s.id)}
              onDismiss={() => dismiss(s.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
