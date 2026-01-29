import { useState, useEffect } from "react";
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
  Database,
} from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { LensedCard } from "@/components/ui/LensedCard";
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

function BlastProgress({ summary }: { summary?: BlastSummary }) {
  if (!summary || summary.total === 0) return null;

  const progress = (summary.completed / summary.total) * 100;
  const isFinished = summary.completed + summary.failed === summary.total;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="text-primary flex items-center gap-1">
              <CheckCircle2 size={12} /> SYNC_COMPLETE
            </span>
          ) : summary.processing > 0 ? (
            <span className="text-cyan-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> DISPATCHING...
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-[8px]">
              UPLINK_STANDBY
            </span>
          )}
        </div>
        <span className="opacity-40">
          {summary.completed} / {summary.total} NODES_REACHED
        </span>
      </div>

      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px] border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            "h-full transition-all duration-700 rounded-full",
            isFinished
              ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.6)]"
              : "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]",
          )}
        />
      </div>

      {summary.failed > 0 && (
        <p className="text-[9px] font-black text-red-500 flex items-center gap-1 uppercase tracking-widest">
          <XCircle size={10} /> {summary.failed} DROPS_DETECTED
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

  // Real-time SSE Connection
  useEffect(() => {
    const url = `${import.meta.env.VITE_API_BASE || "http://localhost:8080/api"}/realtime/blasts`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "blast_update") {
          queryClient.invalidateQueries({
            queryKey: ["automation-rules"],
          });
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Operational history cleared.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-6">
        <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(var(--primary),0.2)]" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse text-primary/60">
          Syncing Neural Vault...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 max-w-7xl mx-auto px-4 font-outfit">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
              <Rocket size={24} fill="currentColor" />
            </div>
            <h1 className="text-6xl font-black tracking-tighter uppercase italic">
              Quick Blast
            </h1>
          </div>
          <p className="text-muted-foreground text-xl font-medium max-w-lg">
            Rapid fire distribution. Sectorized asset broadcasting across all
            active nodes.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Link to="/blast/new">
            <Button
              size="lg"
              className="h-16 px-10 rounded-2xl bg-primary text-slate-950 font-black text-lg gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(var(--primary),0.3)] group border-0"
            >
              NEW BLAST <Zap size={20} className="fill-current" />
            </Button>
          </Link>
        </motion.div>
      </header>

      {rules.length === 0 ? (
        <LensedCard className="py-32 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/5">
          <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mb-8 ring-1 ring-white/10 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700">
            <Database
              className="text-primary opacity-40 blur-[1px]"
              size={48}
            />
          </div>
          <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
            VAULT_STANDBY
          </h3>
          <p className="text-muted-foreground font-medium max-w-md text-lg opacity-60">
            No active broadcast history detected. Prime your vault for a
            wide-sector blast.
          </p>
          <Link to="/blast/new" className="mt-12">
            <Button
              size="lg"
              className="h-16 px-12 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all"
            >
              INITIALIZE FIRST BLAST
            </Button>
          </Link>
        </LensedCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <AnimatePresence mode="popLayout">
            {rules.map((rule: any) => (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <LensedCard className="group h-full flex flex-col p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="font-black text-2xl tracking-tighter uppercase italic truncate max-w-[280px]">
                        {rule.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mt-2">
                        <Clock size={10} />{" "}
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => setRuleToDelete(rule.id)}
                      className="p-3 text-muted-foreground/30 hover:text-red-400 transition-all rounded-xl bg-white/5 hover:bg-red-500/10"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex-1 space-y-8">
                    {/* Source & Targets */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 ring-1 ring-primary/10">
                        <PlatformLogo
                          platform={rule.sourceAccount.platform}
                          size={16}
                          className="text-primary"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                          SRC
                        </span>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-muted-foreground/20"
                      />
                      <div className="flex -space-x-3">
                        {rule.targets.map((t: any) => (
                          <div
                            key={t.accountId}
                            className="w-10 h-10 rounded-full border-2 border-[#0a0a0c] bg-white/5 flex items-center justify-center shadow-2xl ring-1 ring-white/5 group-hover:ring-primary/20 transition-all"
                            title={t.platform}
                          >
                            <PlatformLogo platform={t.platform} size={16} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <BlastProgress summary={rule.summary} />
                  </div>
                </LensedCard>
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
        title="PURGE SESSION?"
        description="This will permanently delete this operational sync record from the vault. Irreversible action."
        confirmText="PURGE RECORD"
        variant="danger"
      />
    </div>
  );
}
