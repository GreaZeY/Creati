import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, Edit2, Play, AlertCircle } from "lucide-react";
import { toast } from "@/lib/events";
import { automationAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { TemplateEditor } from "./TemplateEditor";
import { NewRuleModal } from "./NewRuleModal";
import { Modal } from "@/components/ui/Modal";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";

interface NotificationRule {
  id: number;
  name: string;
  action: string;
  sourceAccount: {
    platform: string;
    profileName: string;
    handle: string;
  };
  isActive: boolean;
  targets: NotificationTarget[];
}

interface NotificationTarget {
  accountId: number;
  platform: string;
  profileName: string;
  handle: string;
  titleTemplate?: string;
  bodyTemplate?: string;
  captionTemplate?: string;
  delaySeconds?: number;
}

export const AudienceRules: React.FC = () => {
  const { selectedClient } = useClient();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<{
    rule: NotificationRule;
    target: NotificationTarget;
  } | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [selectedClient]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await automationAPI.list(selectedClient?.id);
      const allRules = response.data.data || [];
      // Filter for notify rules
      setRules(allRules.filter((r: any) => r.action === "notify"));
    } catch (error) {
      console.error("Failed to fetch notification rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await automationAPI.delete(id);
      toast.success("Rule deleted");
      fetchRules();
    } catch (error) {}
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await automationAPI.toggle(id, !isActive);
      toast.success(isActive ? "Rule disabled" : "Rule enabled");
      fetchRules();
    } catch (error) {}
  };

  const handleSaveTemplate = async (template: {
    title: string;
    body: string;
  }) => {
    if (!editingTemplate) return;
    try {
      const updatedRule = { ...editingTemplate.rule };
      updatedRule.targets = updatedRule.targets.map((t) => {
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
      toast.success("Template saved ✨");
      setEditingTemplate(null);
      fetchRules();
    } catch (error) {}
  };

  if (loading) {
    return <div className="text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Audience Notifications
          </h2>
          <p className="text-muted-foreground">
            Automatically announce new content to your communities.
          </p>
        </div>
        <Button onClick={() => setShowNewRule(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      <NewRuleModal
        isOpen={showNewRule}
        onClose={() => setShowNewRule(false)}
        onSuccess={fetchRules}
      />

      {rules.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 bg-muted/20">
          <p className="text-muted-foreground italic">
            No audience notification rules yet. Create one to get started!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-all overflow-hidden"
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-xl ${rule.isActive ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground border border-border"}`}
                  >
                    {rule.isActive ? (
                      <Play className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{rule.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">
                        <PlatformLogo
                          platform={rule.sourceAccount?.platform || "youtube"}
                          size={12}
                        />
                        {rule.sourceAccount?.platform}
                      </div>
                      <span className="text-white/20 self-center">→</span>
                      <div className="flex flex-col gap-1 mt-3">
                        {rule.targets.map((t, idx) => (
                          <div
                            key={t.accountId}
                            className="flex items-center gap-3 group/target"
                          >
                            <div className="flex flex-col items-center w-4">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover/target:bg-primary transition-colors" />
                              {idx < rule.targets.length - 1 && (
                                <div className="w-0.5 h-6 bg-border/30" />
                              )}
                            </div>

                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg pr-3 py-1 group/btn hover:border-primary/30 transition-all">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] px-2 rounded-full font-black uppercase tracking-widest text-primary hover:bg-transparent"
                                onClick={() =>
                                  setEditingTemplate({
                                    rule: rule,
                                    target: t,
                                  })
                                }
                              >
                                <PlatformLogo
                                  platform={t.platform}
                                  size={12}
                                  className="mr-2"
                                />
                                {t.handle || t.profileName || t.platform}
                                <Edit2
                                  size={10}
                                  className="ml-2 opacity-40 group-hover/btn:opacity-100 transition-opacity"
                                />
                              </Button>

                              {t.delaySeconds && t.delaySeconds > 0 ? (
                                <span className="text-[9px] font-bold text-white/30 uppercase bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  +{" "}
                                  {t.delaySeconds / 60 < 60
                                    ? `${t.delaySeconds / 60}m`
                                    : t.delaySeconds / 3600 < 24
                                      ? `${t.delaySeconds / 3600}h`
                                      : `${t.delaySeconds / 86400}d`}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-primary/40 uppercase">
                                  Instant
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant={rule.isActive ? "outline" : "default"}
                    size="sm"
                    className="h-9 px-4"
                    onClick={() => handleToggle(rule.id, rule.isActive)}
                  >
                    {rule.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive transition-colors rounded-lg"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Modal */}
      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={`Edit Notification Template (${editingTemplate?.target.platform})`}
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
    </div>
  );
};
