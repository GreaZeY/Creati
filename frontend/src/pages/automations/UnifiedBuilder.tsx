import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Zap,
  Bell,
  Layout,
  MessageSquare,
  Info,
  Filter,
  X,
} from "lucide-react";
import { audienceAPI, automationAPI, platformsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { useClient } from "@/context/ClientContext";
import { TemplateEditor } from "@/components/automation/TemplateEditor";
import { PLATFORMS } from "@/lib/constants";

interface UnifiedBuilderProps {
  type: "sync" | "announcement";
}

export function UnifiedBuilder({ type }: UnifiedBuilderProps) {
  const navigate = useNavigate();
  const { selectedClient } = useClient();
  const [currentStep, setCurrentStep] = useState(0);

  // Form State - Shared
  const [ruleName, setRuleName] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
  const [createdRuleId, setCreatedRuleId] = useState<string | null>(null);

  // Form State - Sync Specific
  const [selectedTargetsSync, setSelectedTargetsSync] = useState<
    { accountId: number; captionTemplate: string }[]
  >([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");

  // Form State - Announcement Specific
  const [selectedTargetAccountsAnnounce, setSelectedTargetAccountsAnnounce] =
    useState<number[]>([]);

  const isSync = type === "sync";

  const STEPS = [
    { id: "source", title: "Trigger", icon: Zap },
    { id: "targets", title: "Targets", icon: Layout },
    {
      id: "config",
      title: isSync ? "Filters" : "Template",
      icon: isSync ? Filter : MessageSquare,
    },
    { id: "review", title: "Finalize", icon: Check },
  ];

  // Fetch connected accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["connected-accounts", selectedClient?.id],
    queryFn: async () => {
      const resp = await platformsAPI.list(selectedClient?.id);
      return (resp.data.data || []).filter((a: any) => a.connected);
    },
  });

  // Mutations
  const createSyncMutation = useMutation({
    mutationFn: (data: any) => automationAPI.create(data, selectedClient?.id),
    onSuccess: () => {
      toast.success("Workflow is now active! ✨");
      navigate("/automations/syncs");
    },
  });

  const createAnnounceMutation = useMutation({
    mutationFn: (data: any) => audienceAPI.createRule(data, selectedClient?.id),
    onSuccess: (resp: any) => {
      setCreatedRuleId(resp.data.id);
      setCurrentStep(2); // Move to template step
    },
  });

  // Handlers - Sync
  const handleAddKeyword = () => {
    if (currentKeyword && !keywords.includes(currentKeyword)) {
      setKeywords([...keywords, currentKeyword]);
      setCurrentKeyword("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const toggleTargetSync = (accountId: number) => {
    const exists = selectedTargetsSync.find((t) => t.accountId === accountId);
    if (exists) {
      setSelectedTargetsSync(
        selectedTargetsSync.filter((t) => t.accountId !== accountId),
      );
    } else {
      setSelectedTargetsSync([
        ...selectedTargetsSync,
        { accountId, captionTemplate: "{title}" },
      ]);
    }
  };

  const updateTemplateSync = (accountId: number, template: string) => {
    setSelectedTargetsSync(
      selectedTargetsSync.map((t) =>
        t.accountId === accountId ? { ...t, captionTemplate: template } : t,
      ),
    );
  };

  // Handlers - Announcement
  const toggleTargetAnnounce = (accountId: number) => {
    if (selectedTargetAccountsAnnounce.includes(accountId)) {
      setSelectedTargetAccountsAnnounce(
        selectedTargetAccountsAnnounce.filter((id) => id !== accountId),
      );
    } else {
      setSelectedTargetAccountsAnnounce([
        ...selectedTargetAccountsAnnounce,
        accountId,
      ]);
    }
  };

  const handleCreateBaseAnnounce = () => {
    const sourceAccount = accounts.find(
      (a: any) => a.id === sourceAccountId || a.accountId === sourceAccountId,
    );
    if (!sourceAccount) return;

    createAnnounceMutation.mutate({
      name:
        ruleName ||
        `Announcement from ${sourceAccount.profileName || sourceAccount.handle}`,
      sourcePlatform: sourceAccount.platform,
      eventType: "content_uploaded",
      targets: selectedTargetAccountsAnnounce.map((id) => {
        const targetAccount = accounts.find(
          (a: any) => a.id === id || a.accountId === id,
        );
        return {
          target_platform: targetAccount.platform,
          target_identifier: id.toString(),
        };
      }),
    });
  };

  const handleSaveSync = () => {
    createSyncMutation.mutate({
      name: ruleName,
      sourceAccountId,
      triggerType: "new_upload",
      filters: { keywords },
      targets: selectedTargetsSync,
    });
  };

  const sourceAccount = accounts.find(
    (a: any) => a.id === sourceAccountId || a.accountId === sourceAccountId,
  );

  // Filter accounts based on platform capabilities
  const sourceAccounts = accounts.filter((a: any) => {
    const platformConfig = PLATFORMS[a.platform as keyof typeof PLATFORMS];
    return platformConfig && platformConfig.hasEvents;
  });

  const targetAccounts = accounts.filter(
    (a: any) => (a.id || a.accountId) !== sourceAccountId,
  );

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <header className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(`/automations/${isSync ? "syncs" : "announcements"}`)
          }
          className="rounded-full w-10 h-10 p-0"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold uppercase italic tracking-tighter">
          Setup {isSync ? "Magic Sync" : "Announcer"} Rule
        </h1>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-between px-4 relative">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === idx;
          const isCompleted = currentStep > idx;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-2 relative z-10"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive
                    ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
        <div className="absolute top-[20px] left-[calc(10%+20px)] right-[calc(10%+20px)] h-[2px] bg-muted -z-0" />
      </div>

      <Card className="p-8 mt-4 min-h-[440px] flex flex-col bg-card/40 backdrop-blur-md border-primary/20 relative overflow-hidden">
        {/* Step 0: Source */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-xl font-bold italic tracking-tight uppercase">
                Pick Your Signal 📡
              </Label>
              <p className="text-sm text-muted-foreground">
                {isSync
                  ? "Whenever you drop a banger on this channel, we'll blast it everywhere else."
                  : "Which account upload should trigger this announcement blast?"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {sourceAccounts.map((account: any) => {
                const accId = account.id || account.accountId;
                return (
                  <button
                    key={accId}
                    onClick={() => setSourceAccountId(accId)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group",
                      sourceAccountId === accId
                        ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                        : "border-border/50 hover:border-primary/50 hover:bg-muted/10",
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center p-2">
                      <PlatformLogo platform={account.platform} size={24} />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="font-bold truncate">
                        {account.profileName || account.handle}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        {account.platform}
                      </div>
                    </div>
                    {sourceAccountId === accId && (
                      <div className="ml-auto w-6 h-6 rounded-full bg-primary text-slate-950 flex items-center justify-center">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Targets */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-xl font-bold italic tracking-tight uppercase">
                Choose the Echo 🗣️
              </Label>
              <p className="text-sm text-muted-foreground">
                Where should this content land? Select your target platforms.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {targetAccounts.map((account: any) => {
                const accId = account.id || account.accountId;
                const isSelected = isSync
                  ? !!selectedTargetsSync.find((t) => t.accountId === accId)
                  : selectedTargetAccountsAnnounce.includes(accId);

                return (
                  <button
                    key={accId}
                    onClick={() =>
                      isSync
                        ? toggleTargetSync(accId)
                        : toggleTargetAnnounce(accId)
                    }
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border/50 hover:border-primary/30",
                    )}
                  >
                    <PlatformLogo platform={account.platform} size={18} />
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold truncate">
                        {account.profileName || account.handle}
                      </div>
                      <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {account.platform}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-primary text-slate-950 flex items-center justify-center">
                        <Check size={10} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configuration (Sync: Filters & Captions | Announce: Templates) */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isSync ? (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xl font-bold italic tracking-tight uppercase">
                      Add Filters (Optional) 🔍
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Only sync if the title hits certain keywords. Leave blank
                      to sync everything.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. #short, vlog, tutorial"
                      value={currentKeyword}
                      onChange={(e) => setCurrentKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                      className="bg-background/50 border-primary/20"
                    />
                    <Button onClick={handleAddKeyword} variant="secondary">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {keywords.map((kw) => (
                      <div
                        key={kw}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider"
                      >
                        {kw}
                        <button
                          onClick={() => handleRemoveKeyword(kw)}
                          className="hover:text-primary/70"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                    Custom Captions
                  </Label>
                  <div className="space-y-4 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedTargetsSync.map((t) => {
                      const account = accounts.find(
                        (a) => (a.id || a.accountId) === t.accountId,
                      );
                      return (
                        <div
                          key={t.accountId}
                          className="space-y-2 bg-secondary/20 p-4 rounded-2xl border border-border/50"
                        >
                          <div className="flex items-center gap-2">
                            <PlatformLogo
                              platform={account?.platform}
                              size={14}
                            />
                            <span className="text-xs font-bold">
                              {account?.profileName}
                            </span>
                          </div>
                          <Input
                            value={t.captionTemplate}
                            onChange={(e) =>
                              updateTemplateSync(t.accountId, e.target.value)
                            }
                            placeholder="Use {title} for original title"
                            className="text-xs h-10 bg-background/50"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              createdRuleId && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xl font-bold italic tracking-tight uppercase">
                      Craft the Message ✍️
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Set up how your announcement will look on each platform.
                    </p>
                  </div>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedTargetAccountsAnnounce.map((id) => {
                      const account = accounts.find(
                        (a: any) => (a.id || a.accountId) === id,
                      );
                      return (
                        <div
                          key={id}
                          className="border border-border/50 rounded-2xl overflow-hidden bg-background/30 px-6 py-4"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <PlatformLogo
                              platform={account.platform}
                              size={16}
                              className="text-primary"
                            />
                            <h4 className="text-xs font-black uppercase tracking-[0.2em]">
                              {account.profileName || account.handle} Template
                            </h4>
                          </div>
                          <TemplateEditor
                            ruleId={createdRuleId}
                            platform={account.platform}
                            onSave={() =>
                              toast.success(`Saved for ${account.platform}`)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-xl font-bold italic tracking-tight uppercase">
                Mission Protocol 📡
              </Label>
              <p className="text-sm text-muted-foreground">
                Give this automated {isSync ? "workflow" : "announcer"} a name
                and let's go.
              </p>
            </div>

            <Input
              placeholder={
                isSync
                  ? "e.g. YouTube Shorts to LinkedIn"
                  : "e.g. YouTube Drops to Discord"
              }
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="text-lg h-14 bg-background/50 border-primary/20 focus:ring-primary/20"
            />

            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <Info size={18} />
                <h4 className="font-bold uppercase tracking-wider text-xs">
                  Summary
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-6 text-xs text-left">
                <div>
                  <div className="text-muted-foreground uppercase font-black tracking-widest mb-1">
                    Source
                  </div>
                  <div className="font-bold flex items-center gap-2">
                    <PlatformLogo
                      platform={sourceAccount?.platform}
                      size={14}
                    />
                    {sourceAccount?.profileName || sourceAccount?.handle}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase font-black tracking-widest mb-1">
                    Targets
                  </div>
                  <div className="font-bold">
                    {
                      (isSync
                        ? selectedTargetsSync
                        : selectedTargetAccountsAnnounce
                      ).length
                    }{" "}
                    Accounts Selected
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-auto flex items-center justify-between pt-8 border-t border-border/20">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={
              currentStep === 0 ||
              (!isSync && currentStep === 2 && createdRuleId !== null)
            }
            className="text-xs font-bold uppercase tracking-widest"
          >
            Go Back
          </Button>

          {currentStep === 0 && (
            <Button
              onClick={() => setCurrentStep(1)}
              disabled={!sourceAccountId}
              className="group"
            >
              Next Step
              <ArrowRight
                size={18}
                className="ml-2 transition-transform group-hover:translate-x-1"
              />
            </Button>
          )}

          {currentStep === 1 && (
            <Button
              onClick={() =>
                isSync ? setCurrentStep(2) : handleCreateBaseAnnounce()
              }
              disabled={
                (isSync
                  ? selectedTargetsSync.length === 0
                  : selectedTargetAccountsAnnounce.length === 0) ||
                createAnnounceMutation.isPending
              }
            >
              {createAnnounceMutation.isPending
                ? "Configuring..."
                : isSync
                  ? "Add Filters"
                  : "Configure Templates"}
              <ArrowRight size={18} className="ml-2" />
            </Button>
          )}

          {currentStep === 2 && (
            <Button onClick={() => setCurrentStep(3)}>
              Final Review
              <ArrowRight size={18} className="ml-2" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              onClick={
                isSync
                  ? handleSaveSync
                  : () => {
                      toast.success("Announcer is live! 🚀");
                      navigate("/automations/announcements");
                    }
              }
              disabled={createSyncMutation.isPending}
              className="bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 px-8"
            >
              {createSyncMutation.isPending
                ? "Activating..."
                : "Finish & Deploy"}
              {isSync ? (
                <Zap size={18} className="ml-2 fill-current" />
              ) : (
                <Bell size={18} className="ml-2" />
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
