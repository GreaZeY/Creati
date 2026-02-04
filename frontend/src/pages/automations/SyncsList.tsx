import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Pause, Play, Trash2, ArrowRight } from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/features";
import { useClient } from "@/context/ClientContext";

export function SyncsList() {
  const queryClient = useQueryClient();
  const { canUse, isLoading: isEntitlementLoading } = useEntitlement();
  const { selectedClient } = useClient();

  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const { data: rules = [], isLoading: isRulesLoading } = useQuery({
    queryKey: ["automation-rules", selectedClient?.id],
    queryFn: async () => {
      const resp = await automationAPI.list(selectedClient?.id);
      return (resp.data.data || []).filter(
        (r: any) => r.triggerType === "new_upload",
      );
    },
    enabled: canUse(CAPABILITIES.CAN_USE_MAGIC_SYNC),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      automationAPI.toggle(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", selectedClient?.id],
      });
      toast.success("Status updated. ✨");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", selectedClient?.id],
      });
      toast.success("Workflow removed.");
    },
  });

  const isLoading = isEntitlementLoading || isRulesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="A BIT QUIET IN HERE..."
        description="Turn one upload into a viral spree. Sync your Insta heat to YT, LinkedIn & more."
        actionLabel="LET'S COOK"
        actionLink="/automations/syncs/new"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <AnimatePresence mode="popLayout">
        {rules.map((rule: any) => (
          <motion.div
            key={rule.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card
              className={cn(
                "group relative p-6 transition-all duration-300 overflow-hidden",
                !rule.isActive && "opacity-60 grayscale-[0.4]",
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="relative">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      rule.isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Zap
                      size={24}
                      fill={rule.isActive ? "currentColor" : "none"}
                    />
                  </div>
                  {rule.isActive && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-background animate-pulse" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">
                      {rule.name}
                    </h3>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        rule.isActive
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {rule.isActive ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-3 text-sm">
                    <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-lg">
                      <PlatformLogo
                        platform={rule.sourceAccount.platform}
                        size={14}
                        className="text-primary"
                      />
                      <span className="text-xs font-medium truncate max-w-[120px]">
                        {rule.sourceAccount.profileName ||
                          rule.sourceAccount.handle}
                      </span>
                    </div>

                    <ArrowRight size={16} className="text-muted-foreground" />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rule.targets.slice(0, 3).map((target: any) => (
                        <div
                          key={target.accountId}
                          className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-lg"
                        >
                          <PlatformLogo
                            platform={target.platform}
                            size={14}
                            className="text-muted-foreground"
                          />
                          <span className="text-xs font-medium truncate max-w-[120px]">
                            {target.profileName || target.handle}
                          </span>
                        </div>
                      ))}
                      {rule.targets.length > 3 && (
                        <span className="text-xs text-muted-foreground font-medium">
                          +{rule.targets.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3"
                    onClick={() =>
                      toggleMutation.mutate({
                        id: rule.id,
                        isActive: !rule.isActive,
                      })
                    }
                  >
                    {rule.isActive ? (
                      <>
                        <Pause size={16} className="mr-2" /> Pause
                      </>
                    ) : (
                      <>
                        <Play size={16} className="mr-2" /> Resume
                      </>
                    )}
                  </Button>

                  <button
                    onClick={() => setRuleToDelete(rule.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/5"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

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
        title="Delete Workflow"
        description="Are you sure you want to delete this workflow?"
        confirmText="Delete It"
        variant="danger"
      />
    </div>
  );
}
