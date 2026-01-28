import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Trash2,
  ArrowRight,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "react-router-dom";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

interface BlastSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

function BlastProgress({ ruleId }: { ruleId: number }) {
  const { data: summary } = useQuery({
    queryKey: ["blast-summary", ruleId],
    queryFn: async () => {
      const resp = await automationAPI.getBlastSummary(ruleId);
      return resp.data.data as BlastSummary;
    },
    refetchInterval: (query) => {
      const data = query.state.data as BlastSummary | undefined;
      if (!data) return 3000;
      // Stop polling if all jobs are final
      if (data.completed + data.failed === data.total && data.total > 0)
        return false;
      return 3000;
    },
  });

  if (!summary || summary.total === 0) return null;

  const progress = (summary.completed / summary.total) * 100;
  const isFinished = summary.completed + summary.failed === summary.total;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="text-primary flex items-center gap-1">
              <CheckCircle2 size={12} /> ALL PUBLISHED
            </span>
          ) : summary.processing > 0 ? (
            <span className="text-yellow-500 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> BLASTING...
            </span>
          ) : (
            <span className="text-muted-foreground">QUEUED</span>
          )}
        </div>
        <span className="opacity-60">
          {summary.completed} / {summary.total} SHOTS FIRED
        </span>
      </div>

      <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden border border-border/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            "h-full transition-all duration-500",
            isFinished
              ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              : "bg-primary/60",
          )}
        />
      </div>

      {summary.failed > 0 && (
        <p className="text-[10px] font-bold text-destructive flex items-center gap-1">
          <XCircle size={10} /> {summary.failed} MISSES
        </p>
      )}
    </div>
  );
}

export function ArchiveBlast() {
  const queryClient = useQueryClient();
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const resp = await automationAPI.list();
      return (resp.data.data || []).filter(
        (r: any) => r.triggerType === "manual",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Blast history cleared.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">
          Raiding Archive...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto px-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Rocket size={24} fill="currentColor" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">
              The Blast 🚀
            </h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Manual video distribution. Raid your vault and fire 'em off
            everywhere instantly.
          </p>
        </div>
        <Link to="/blast/new">
          <Button
            size="lg"
            className="h-14 px-10 rounded-2xl font-black text-lg gap-3 shadow-[0_10px_30px_rgba(var(--primary),0.2)] hover:scale-105 active:scale-95 transition-all"
          >
            NEW BLAST <Zap size={20} className="fill-current" />
          </Button>
        </Link>
      </header>

      {rules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-20 text-center border-4 border-dashed border-primary/10 bg-primary/5 rounded-[3rem]">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Rocket className="text-primary animate-bounce" size={48} />
          </div>
          <h3 className="text-3xl font-black italic mb-2 tracking-tight">
            VAULT IS FULL? 💀
          </h3>
          <p className="text-muted-foreground font-medium max-w-md">
            Got some archive bangers that need more eyeballs? Blast them across
            all platforms in seconds.
          </p>
          <Link to="/blast/new" className="mt-8">
            <Button size="lg" className="rounded-xl px-12 h-12 font-bold gap-2">
              START YOUR FIRST BLAST
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {rules.map((rule: any) => (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="group relative p-6 h-full bg-card/60 border-border/40 hover:border-linear transition-all duration-500 overflow-hidden flex flex-col">
                  {/* Background Flair */}
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Rocket size={100} className="-rotate-45" />
                  </div>

                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-black text-xl tracking-tight uppercase italic truncate max-w-[250px]">
                        {rule.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
                        <Clock size={10} />{" "}
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => setRuleToDelete(rule.id)}
                      className="p-2 text-muted-foreground/40 hover:text-destructive transition-colors rounded-lg bg-secondary/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex-1 space-y-4">
                    {/* Source & Targets */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                        <PlatformLogo
                          platform={rule.sourceAccount.platform}
                          size={14}
                        />
                        <span className="text-[10px] font-black uppercase text-primary">
                          Source
                        </span>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-muted-foreground/40"
                      />
                      <div className="flex -space-x-2">
                        {rule.targets.map((t: any) => (
                          <div
                            key={t.accountId}
                            className="w-8 h-8 rounded-full border-2 border-card bg-secondary flex items-center justify-center shadow-lg"
                            title={t.platform}
                          >
                            <PlatformLogo platform={t.platform} size={14} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <BlastProgress ruleId={rule.id} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        isOpen={ruleToDelete !== null}
        onClose={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            deleteMutation.mutate(ruleToDelete);
            setRuleToDelete(null);
          }
        }}
        isLoading={deleteMutation.isPending}
        title="CLEAR BLAST HISTORY"
        description="This will remove this blast from your dashboard. It won't affect any videos already sent."
        confirmText="CLEAR IT"
        variant="danger"
      />
    </div>
  );
}
