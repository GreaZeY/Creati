import { useQuery } from "@tanstack/react-query";
import { aiAPI } from "@/lib/api";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreditIndicator() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-credits"],
    queryFn: async () => {
      const response = await aiAPI.getCredits();
      return response.data.data.credits;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const credits = data ?? 0;
  const isLow = credits < 5;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
        <Sparkles size={14} className="animate-pulse" />
        <span>--</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
        isLow
          ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
          : "bg-primary/10 text-primary ring-1 ring-primary/20",
      )}
    >
      <Sparkles size={14} className={isLow ? "animate-pulse" : ""} />
      <span>{credits} AI</span>
    </div>
  );
}
