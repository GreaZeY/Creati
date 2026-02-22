import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useBlocker } from "react-router-dom";
import {
  Check,
  Zap,
  Bell,
  Layout,
  MessageSquare,
  Filter,
  Sparkles,
  Info,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { automationAPI, platformsAPI } from "@/lib/api";
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface UnifiedBuilderProps {
  initialType?: "sync" | "notify" | null;
}

export function UnifiedBuilder({ initialType }: UnifiedBuilderProps) {
  const navigate = useNavigate();
  const { selectedClient } = useClient();
  const [currentStep, setCurrentStep] = useState(0);

  // Mutations
  const createSyncMutation = useMutation({
    mutationFn: (data: any) => automationAPI.create(data, selectedClient?.id),
    onSuccess: () => {
      toast.success("Workflow is now active! ✨");
      navigate("/automations");
    },
  });

  // Form State - Shared
  const [ruleName, setRuleName] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);

  // Form State - Sync Specific
  const [selectedTargetsSync, setSelectedTargetsSync] = useState<
    { accountId: number; captionTemplate: string; delaySeconds: number }[]
  >([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");

  // Form State - Announcement Specific
  const [selectedTargetAccountsAnnounce, setSelectedTargetAccountsAnnounce] =
    useState<{ accountId: number; delaySeconds: number }[]>([]);
  const [announcementTemplates, setAnnouncementTemplates] = useState<
    Record<number, { title: string; body: string }>
  >({});

  const [type, setType] = useState<"sync" | "notify" | null>(
    initialType || null,
  );
  const isSync = type === "sync";

  const STEPS = [
    { id: "type", title: "Type", icon: Sparkles },
    { id: "source", title: "Trigger", icon: Zap },
    { id: "targets", title: "Targets", icon: Layout },
    {
      id: "config",
      title: isSync ? "Filters" : "Template",
      icon: isSync ? Filter : MessageSquare,
    },
    { id: "review", title: "Finalize", icon: Check },
  ];

  // Dirty State for Navigation Lock
  const isDirty =
    currentStep > 0 &&
    currentStep < STEPS.length - 1 &&
    !createSyncMutation.isSuccess;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const confirmNavigation = () => {
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  };

  const cancelNavigation = () => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  };

  // Fetch connected accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["connected-accounts", selectedClient?.id],
    queryFn: async () => {
      const resp = await platformsAPI.list(selectedClient?.id);
      return (resp.data.data || []).filter((a: any) => a.connected);
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
        {
          accountId: Number(accountId),
          captionTemplate: "{title}",
          delaySeconds: 0,
        },
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

  const updateDelaySync = (accountId: number, seconds: number) => {
    setSelectedTargetsSync(
      selectedTargetsSync.map((t) =>
        t.accountId === accountId ? { ...t, delaySeconds: seconds } : t,
      ),
    );
  };

  // Handlers - Announcement
  const toggleTargetAnnounce = (accountId: number) => {
    const id = Number(accountId);
    const exists = selectedTargetAccountsAnnounce.find(
      (t) => t.accountId === id,
    );
    if (exists) {
      setSelectedTargetAccountsAnnounce(
        selectedTargetAccountsAnnounce.filter((t) => t.accountId !== id),
      );
    } else {
      setSelectedTargetAccountsAnnounce([
        ...selectedTargetAccountsAnnounce,
        { accountId: id, delaySeconds: 0 },
      ]);
    }
  };

  const updateDelayAnnounce = (accountId: number, seconds: number) => {
    setSelectedTargetAccountsAnnounce(
      selectedTargetAccountsAnnounce.map((t) =>
        t.accountId === accountId ? { ...t, delaySeconds: seconds } : t,
      ),
    );
  };

  const handleSaveAnnouncement = () => {
    const sourceAccount = accounts.find((a: any) => a.id === sourceAccountId);
    if (!sourceAccount) return;

    createSyncMutation.mutate({
      action: "notify",
      name:
        ruleName ||
        `Announcement from ${sourceAccount.profileName || sourceAccount.handle}`,
      sourceAccountId: Number(sourceAccountId),
      triggerType: "new_upload",
      filters: {},
      targets: selectedTargetAccountsAnnounce.map((t) => {
        const targetAccount = accounts.find((a: any) => a.id === t.accountId);
        const template = announcementTemplates[t.accountId] || {
          title: "",
          body: "🔥 New video dropped!\n\n{{title}}\n\nWatch here 👇\n{{url}}",
        };
        return {
          accountId: Number(t.accountId),
          captionTemplate: template.body,
          titleTemplate: template.title, // Extra info for notify
          targetPlatform: targetAccount?.platform || "",
          targetIdentifier: t.accountId.toString(),
          delaySeconds: t.delaySeconds,
        };
      }),
    });
  };

  const handleSaveSync = () => {
    createSyncMutation.mutate({
      action: "sync",
      name: ruleName,
      sourceAccountId: Number(sourceAccountId),
      triggerType: "new_upload",
      filters: { keywords },
      targets: selectedTargetsSync.map((t) => ({
        ...t,
        accountId: Number(t.accountId),
      })),
    });
  };

  const sourceAccount = accounts.find((a: any) => a.id === sourceAccountId);

  // Filter accounts based on platform capabilities
  const sourceAccounts = accounts.filter((a: any) => {
    if (!a?.platform) return false;
    const platformConfig = PLATFORMS[a.platform as keyof typeof PLATFORMS];
    return platformConfig && platformConfig.hasEvents;
  });

  const targetAccounts = accounts.filter((a: any) => {
    const isSourceMatched = a.id === sourceAccountId;
    if (isSync) {
      // For sync, source account AND its platform should be excluded
      // (Wait, user says source should not appear in targets, but in notify it can)
      // Actually if it's sync, we can't sync to the same account.
      return !isSourceMatched;
    }
    // For notify, source can be a target (e.g. notify discord about youtube upload)
    return true;
  });

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
                  "text-[10px] font-black uppercase tracking-widest",
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

      <Card className="p-8 mt-4 min-h-[440px] flex flex-col bg-white/40 dark:bg-card/40 backdrop-blur-md border-border dark:border-primary/20 relative overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-border">
        {/* Step 0: Type Selection */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col justify-center">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                Choose Your Path ⚡
              </h2>
              <p className="text-muted-foreground text-sm">
                How do you want to automate your reach?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
              <button
                onClick={() => {
                  setType("sync");
                  setCurrentStep(1);
                }}
                className={cn(
                  "flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                  type === "sync"
                    ? "border-primary bg-primary/10 dark:bg-primary/5 ring-4 ring-primary/20 shadow-lg"
                    : "border-border/50 hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-muted/10",
                )}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Zap size={32} fill="currentColor" />
                </div>
                <div className="text-center">
                  <div className="font-black uppercase tracking-tighter text-lg">
                    Magic Sync
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                    Cross-platform Uploads
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setType("notify");
                  setCurrentStep(1);
                }}
                className={cn(
                  "flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                  type === "notify"
                    ? "border-primary bg-primary/10 dark:bg-primary/5 ring-4 ring-primary/20 shadow-lg"
                    : "border-border/50 hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-muted/10",
                )}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Bell size={32} fill="currentColor" />
                </div>
                <div className="text-center">
                  <div className="font-black uppercase tracking-tighter text-lg">
                    Announcer
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                    Social Notifications
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Source */}
        {currentStep === 1 && (
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
                const accId = Number(account.id);
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
                      <PlatformLogo platform={account?.platform} size={24} />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="font-bold truncate">
                        {account?.profileName || account?.handle}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        {account?.platform}
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

        {/* Step 2: Targets */}
        {currentStep === 2 && (
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
                const accId = Number(account.id);
                const isSelected = isSync
                  ? !!selectedTargetsSync.find((t) => t.accountId === accId)
                  : !!selectedTargetAccountsAnnounce.find(
                      (t) => t.accountId === accId,
                    );

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
                    <PlatformLogo platform={account?.platform} size={18} />
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold truncate">
                        {account?.profileName || account?.handle}
                      </div>
                      <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {account?.platform}
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

        {/* Step 3: Configuration (Sync: Filters & Captions | Announce: Templates) */}
        {currentStep === 3 && (
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
                        (a) => a.id === t.accountId,
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
                          <div className="flex items-center gap-4">
                            <div className="flex-1 space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Caption Template
                              </Label>
                              <Input
                                value={t.captionTemplate}
                                onChange={(e) =>
                                  updateTemplateSync(
                                    t.accountId,
                                    e.target.value,
                                  )
                                }
                                placeholder="Use {title} for original title"
                                className="text-xs h-10 bg-background/50"
                              />
                            </div>
                            <div className="w-32 space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Delay (Days)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={Math.floor(t.delaySeconds / 86400)}
                                onChange={(e) =>
                                  updateDelaySync(
                                    t.accountId,
                                    Number(e.target.value) * 86400,
                                  )
                                }
                                className="text-xs h-10 bg-background/50 text-center"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedTargetAccountsAnnounce.map((target) => {
                  const account = accounts.find(
                    (a: any) => a.id === target.accountId,
                  );
                  return (
                    <div
                      key={target.accountId}
                      className="border border-border/50 rounded-2xl overflow-hidden bg-background/30 px-6 py-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <PlatformLogo
                            platform={account?.platform}
                            size={16}
                            className="text-primary"
                          />
                          <h4 className="text-xs font-black uppercase tracking-[0.2em]">
                            {account?.profileName ||
                              account?.handle ||
                              "Account"}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Delay (Days)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={Math.floor(target.delaySeconds / 86400)}
                            onChange={(e) =>
                              updateDelayAnnounce(
                                target.accountId,
                                Number(e.target.value) * 86400,
                              )
                            }
                            className="text-xs h-7 w-16 bg-background/50 text-center"
                          />
                        </div>
                      </div>
                      <TemplateEditor
                        platform={account?.platform}
                        onSave={(template) => {
                          setAnnouncementTemplates({
                            ...announcementTemplates,
                            [target.accountId]: template,
                          });
                          toast.success(`Saved for ${account?.platform}`);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
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
            onClick={() => {
              if (currentStep === 1) {
                setType(null);
                setCurrentStep(0);
              } else {
                setCurrentStep(Math.max(0, currentStep - 1));
              }
            }}
            disabled={currentStep === 0}
            className="text-xs font-bold uppercase tracking-widest"
          >
            Go Back
          </Button>

          {currentStep === 1 && (
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!sourceAccountId}
              className="group"
            >
              Next: Select Targets
              <ArrowRight
                size={18}
                className="ml-2 transition-transform group-hover:translate-x-1"
              />
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={
                isSync
                  ? selectedTargetsSync.length === 0
                  : selectedTargetAccountsAnnounce.length === 0
              }
            >
              Next: Configure
              <ArrowRight size={18} className="ml-2" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button onClick={() => setCurrentStep(4)}>
              Final Review
              <ArrowRight size={18} className="ml-2" />
            </Button>
          )}

          {currentStep === 4 && (
            <Button
              onClick={isSync ? handleSaveSync : handleSaveAnnouncement}
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

      {/* Navigation Blocker Dialog */}
      <ConfirmDialog
        isOpen={blocker.state === "blocked"}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="Unsaved Changes"
        description="You're in the middle of creating an automation. If you leave now, your progress will be lost. Are you sure?"
        confirmText="Leave Page"
        cancelText="Stay Here"
        variant="danger"
      />
    </div>
  );
}
