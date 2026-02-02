import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  ArrowRight,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { LensedCard } from "@/components/ui/LensedCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "react-router-dom";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useClient } from "@/context/ClientContext";

interface BlastSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  failures?: Record<string, string>;
}

function BlastProgress({
  summary,
  onRetry,
}: {
  summary?: BlastSummary;
  onRetry?: () => void;
}) {
  if (!summary || summary.total === 0) {
    return (
      <div className="space-y-4 opacity-40">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Standby
          </span>
          <span className="text-xs font-black italic tracking-tighter">0%</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full w-0 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
        </div>
      </div>
    );
  }

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

      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden p-[1px] border border-border">
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
        <div className="flex items-center justify-between gap-4">
          <p className="text-[9px] font-black text-red-500 flex items-center gap-1 uppercase tracking-widest">
            <XCircle size={10} /> {summary.failed} DROPS_DETECTED
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-6 px-3 rounded-lg border-red-500/20 text-[8px] font-black text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all uppercase tracking-tighter"
          >
            RETRY_FAILS <Zap size={8} className="ml-1 fill-current" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ArchiveBlast() {
  const queryClient = useQueryClient();
  const { selectedClient } = useClient();
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules", selectedClient?.id],
    queryFn: async () => {
      const resp = await automationAPI.list(selectedClient?.id);
      return (resp.data.data || []).filter(
        (r: any) => r.triggerType === "manual",
      );
    },
  });

  // Real-time SSE Connection
  useEffect(() => {
    const url = "/api/realtime/blasts";
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "blast_update") {
          queryClient.invalidateQueries({
            queryKey: ["automation-rules", selectedClient?.id],
          });
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient, selectedClient?.id]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", selectedClient?.id],
      });
      toast.success("Operational history cleared.");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => automationAPI.retryRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", selectedClient?.id],
      });
      toast.success("Re-initializing failed uplink sectors...");
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
    <div className="space-y-8 pb-12 max-w-7xl mx-auto px-4 font-outfit">
      <PageHeader
        title="Quick Blast"
        description="Rapid fire distribution. Sectorized asset broadcasting across all active nodes."
      >
        <Link to="/blast/new">
          <Button className="gap-2">
            <Plus size={18} />
            New Blast
          </Button>
        </Link>
      </PageHeader>

      {rules.length === 0 ? (
        <EmptyState
          icon={Database}
          title="VAULT_STANDBY"
          description="No active broadcast history detected. Prime your vault for a wide-sector blast."
          actionLabel="INITIALIZE FIRST BLAST"
          actionLink="/blast/new"
        />
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
                      className="p-3 text-muted-foreground/30 hover:text-red-400 transition-all rounded-xl bg-muted/50 hover:bg-red-500/10"
                    >
                      <Trash2 color="red" size={18} />
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
                        {rule.targets.map((t: any) => {
                          const error = rule.summary?.failures?.[t.platform];
                          return (
                            <div
                              key={t.accountId}
                              className="relative group/node"
                            >
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center shadow-2xl ring-1 ring-border group-hover:ring-primary/20 transition-all",
                                  error && "ring-red-500/50 border-red-500/20",
                                )}
                              >
                                <PlatformLogo platform={t.platform} size={16} />
                                {error && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-background">
                                    <span className="text-[6px] font-black">
                                      !
                                    </span>
                                  </div>
                                )}
                              </div>
                              {error && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 opacity-0 group-hover/node:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover/node:translate-y-0 z-50">
                                  <div className="bg-popover/90 backdrop-blur-xl border border-red-500/30 p-3 rounded-xl shadow-2xl">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertTriangle
                                        size={10}
                                        className="text-red-400"
                                      />
                                      <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">
                                        Drop Failure
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-foreground font-medium leading-relaxed">
                                      {error}
                                    </p>
                                  </div>
                                  <div className="w-2 h-2 bg-popover/90 rotate-45 border-r border-b border-red-500/30 mx-auto -mt-1" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <BlastProgress
                      summary={rule.summary}
                      onRetry={() => retryMutation.mutate(rule.id)}
                    />
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
