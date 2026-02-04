import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, Edit2, Play, AlertCircle } from "lucide-react";
import { toast } from "@/lib/events";
import { audienceAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { TemplateEditor } from "./TemplateEditor";
import { NewRuleModal } from "./NewRuleModal";
import { Modal } from "@/components/ui/Modal";

interface NotificationRule {
  id: string;
  name: string;
  source_platform: string;
  event_type: string;
  enabled: boolean;
  targets: NotificationTarget[];
}

interface NotificationTarget {
  id: string;
  target_platform: string;
  target_identifier: string;
}

export const AudienceRules: React.FC = () => {
  const { selectedClient } = useClient();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<{
    ruleId: string;
    platform: string;
  } | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [selectedClient]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await audienceAPI.listRules(selectedClient?.id);
      setRules(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch audience notification rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await audienceAPI.deleteRule(id);
      toast.success("Rule deleted");
      fetchRules();
    } catch (error) {}
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await audienceAPI.toggleRule(id, !enabled);
      toast.success(enabled ? "Rule disabled" : "Rule enabled");
      fetchRules();
    } catch (error) {}
  };

  const handleSaveTemplate = async (template: {
    title: string;
    body: string;
  }) => {
    if (!editingTemplate) return;
    try {
      await audienceAPI.saveTemplate({
        rule_id: editingTemplate.ruleId,
        platform: editingTemplate.platform,
        title_template: template.title,
        body_template: template.body,
      });
      toast.success("Template saved ✨");
      setEditingTemplate(null);
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
                    className={`p-3 rounded-xl ${rule.enabled ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground border border-border"}`}
                  >
                    {rule.enabled ? (
                      <Play className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{rule.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs uppercase px-2 py-0.5 rounded-full border border-border bg-background/50">
                        {rule.source_platform}
                      </span>
                      <span className="text-muted-foreground text-xs flex items-center">
                        →
                      </span>
                      {rule.targets.map((t) => (
                        <Button
                          key={t.id}
                          variant="secondary"
                          size="sm"
                          className="h-6 text-[10px] px-2 rounded-full font-bold uppercase tracking-wider"
                          onClick={() =>
                            setEditingTemplate({
                              ruleId: rule.id,
                              platform: t.target_platform,
                            })
                          }
                        >
                          {t.target_platform}
                          <Edit2 className="w-2 h-2 ml-1 opacity-50" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant={rule.enabled ? "outline" : "default"}
                    size="sm"
                    className="h-9 px-4"
                    onClick={() => handleToggle(rule.id, rule.enabled)}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
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
        title={`Edit Notification Template (${editingTemplate?.platform})`}
      >
        {editingTemplate && (
          <div className="py-2">
            <TemplateEditor
              ruleId={editingTemplate.ruleId}
              platform={editingTemplate.platform}
              onSave={handleSaveTemplate}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
