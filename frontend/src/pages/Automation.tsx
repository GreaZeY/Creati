import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Zap,
  Pause,
  Play,
  Trash2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/features";
import { useClient } from "@/context/ClientContext";

interface AccountInfo {
  accountId: number;
  profileName: string;
  handle: string;
  platform: string;
}

interface TargetWithInfo extends AccountInfo {
  captionTemplate: string;
}

interface AutomationRule {
  id: number;
  name: string;
  sourceAccount: AccountInfo;
  triggerType: string;
  filters: any;
  targets: TargetWithInfo[];
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

export function Automation() {
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
    enabled: canUse(CAPABILITIES.CAN_USE_MAGIC_SYNC), // Only fetch if allowed
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

  const isLoading = isRulesLoading || isEntitlementLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Entitlement Gate
  if (!canUse(CAPABILITIES.CAN_USE_MAGIC_SYNC)) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-8">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Zap className="text-primary w-12 h-12" />
        </div>
        <h1 className="text-4xl font-bold">Unleash the Magic ✨</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Magic Sync automates your entire distribution workflow. Post once on
          YouTube, and we'll handle Insta, LinkedIn, and more.
        </p>
        <div className="p-6 bg-secondary/30 rounded-xl border border-dashed border-primary/20 max-w-lg mx-auto">
          <p className="font-medium mb-4">
            Upgrade to Creator or Pro to access:
          </p>
          <ul className="text-sm space-y-2 text-left inline-block">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Auto-sync
              to unlimited platforms
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Custom
              filter rules
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />{" "}
              Set-and-forget processing
            </li>
          </ul>
        </div>
        <Link to="/pricing">
          <Button
            size="lg"
            className="h-12 px-8 text-lg shadow-lg shadow-primary/25 mt-4"
          >
            Upgrade to Unlock
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Workflows"
        description="Blast your content across platforms automatically."
      >
        <Link to="/automation/new">
          <Button className="gap-2">
            <Plus size={18} />
            New Workflow
          </Button>
        </Link>
      </PageHeader>

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="A BIT QUIET IN HERE..."
          description="Turn one upload into a viral spree. Sync your Insta heat to YT, LinkedIn & more."
          actionLabel="LET'S COOK"
          actionLink="/automation/new"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {rules.map((rule: AutomationRule) => (
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
                    {/* Status Icon with minimalistic pulse for active */}
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
                      {/* Minimalistic active indicator - subtle dot */}
                      {rule.isActive && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-background animate-pulse" />
                      )}
                    </div>

                    {/* Info */}
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

                      {/* Source → Targets display */}
                      <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-3 text-sm">
                        {/* Source Account */}
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

                        <ArrowRight
                          size={16}
                          className="text-muted-foreground"
                        />

                        {/* Target Accounts */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rule.targets.slice(0, 3).map((target) => (
                            <div
                              key={target.accountId}
                              className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-lg"
                              title={`${target.profileName || target.handle}`}
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

                        {rule.lastRunAt && (
                          <div className="flex items-center gap-1.5 text-muted-foreground border-l border-border pl-3 ml-1">
                            <Clock size={14} />
                            <span className="text-xs">
                              {new Date(rule.lastRunAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
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

                  {/* Minimalistic left accent bar for active rules */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                      rule.isActive ? "bg-emerald-500" : "bg-muted",
                    )}
                  />
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
        title="Delete Workflow"
        description="Are you sure you want to delete this workflow? This action cannot be undone and all sync history will be lost."
        confirmText="Delete It"
        variant="danger"
      />
    </div>
  );
}
