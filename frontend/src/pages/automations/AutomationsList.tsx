import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, Pause, Play, Trash2, ArrowRight } from "lucide-react";
import { automationAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useClient } from "@/context/ClientContext";
import { Modal } from "@/components/ui/Modal";
import { TemplateEditor } from "@/components/automation/TemplateEditor";

export function AutomationsList() {
  const queryClient = useQueryClient();
  const { selectedClient } = useClient();

  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{
    rule: any;
    target: any;
  } | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules", selectedClient?.id],
    queryFn: async () => {
      const resp = await automationAPI.list(selectedClient?.id);
      return resp.data.data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      automationAPI.toggle(id, !isActive),
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
      toast.success("Rule removed.");
    },
  });

  const handleSaveTemplate = async (template: {
    title: string;
    body: string;
  }) => {
    if (!editingTemplate) return;
    try {
      const updatedRule = { ...editingTemplate.rule };
      updatedRule.targets = updatedRule.targets.map((t: any) => {
        if (t.accountId === editingTemplate.target.accountId) {
          return {
            ...t,
            titleTemplate: template.title,
            bodyTemplate: template.body,
          };
        }
        return t;
      });

      await automationAPI.update(updatedRule.id, updatedRule);
      toast.success("Template updated. ✨");
      setEditingTemplate(null);
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", selectedClient?.id],
      });
    } catch (error) {}
  };

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
        title="NO AUTOMATIONS YET"
        description="Sync uploads or send announcements automatically."
        actionLabel="GET STARTED"
        actionLink="/automations/new"
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
                    {rule.action === "sync" ? (
                      <Zap
                        size={24}
                        fill={rule.isActive ? "currentColor" : "none"}
                      />
                    ) : (
                      <Bell
                        size={24}
                        fill={rule.isActive ? "currentColor" : "none"}
                      />
                    )}
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground">
                      {rule.action === "sync" ? "Sync" : "Announcement"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-3 text-sm">
                    <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-lg">
                      <PlatformLogo
                        platform={rule.sourceAccount?.platform || "youtube"}
                        size={14}
                        className="text-primary"
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {rule.sourceAccount?.profileName ||
                          rule.sourceAccount?.platform}
                      </span>
                    </div>

                    <ArrowRight size={16} className="text-muted-foreground" />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rule.targets?.map((target: any) => (
                        <div
                          key={target.accountId}
                          className="flex items-center gap-1.5"
                        >
                          <div className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-lg">
                            <PlatformLogo
                              platform={target?.platform}
                              size={14}
                              className="text-muted-foreground"
                            />
                            <span className="text-xs font-medium truncate max-w-[120px]">
                              {target?.profileName ||
                                target?.handle ||
                                target?.platform}
                            </span>
                          </div>
                        </div>
                      ))}
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
                        isActive: rule.isActive,
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

      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={`Customize Announcement Template`}
      >
        {editingTemplate && (
          <div className="py-2">
            <TemplateEditor
              platform={editingTemplate.target.platform}
              initialTitle={editingTemplate.target.titleTemplate}
              initialBody={
                editingTemplate.target.bodyTemplate ||
                editingTemplate.target.captionTemplate
              }
              onSave={handleSaveTemplate}
            />
          </div>
        )}
      </Modal>

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
        title="Delete Rule"
        description="Are you sure you want to delete this automation?"
        confirmText="Delete It"
        variant="danger"
      />
    </div>
  );
}
