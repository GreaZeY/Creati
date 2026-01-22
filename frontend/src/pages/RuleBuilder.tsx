import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Youtube,
    Filter,
    Layout,
    Zap,
    X,
    Info
} from 'lucide-react';
import { automationAPI, platformsAPI } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/events';
import { PlatformLogo } from '@/components/platforms/PlatformLogo';
import { PLATFORMS } from '@/lib/constants';

const STEPS = [
    { id: 'source', title: 'Source', icon: Youtube },
    { id: 'filters', title: 'Filters', icon: Filter },
    { id: 'targets', title: 'Targets', icon: Layout },
    { id: 'review', title: 'Check', icon: Check },
];

export function RuleBuilder() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [ruleName, setRuleName] = useState('');
    const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [currentKeyword, setCurrentKeyword] = useState('');
    const [selectedTargets, setSelectedTargets] = useState<{ accountId: number; captionTemplate: string }[]>([]);

    const { data: accounts = [] } = useQuery({
        queryKey: ['connected-accounts'],
        queryFn: async () => {
            const resp = await platformsAPI.list();
            return (resp.data.data || []).filter((a: any) => a.connected);
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => automationAPI.create(data),
        onSuccess: () => {
            toast.success('Workflow is now active! ✨');
            navigate('/automation');
        },
    });

    const handleAddKeyword = () => {
        if (currentKeyword && !keywords.includes(currentKeyword)) {
            setKeywords([...keywords, currentKeyword]);
            setCurrentKeyword('');
        }
    };

    const handleRemoveKeyword = (kw: string) => {
        setKeywords(keywords.filter(k => k !== kw));
    };

    const toggleTarget = (accountId: number) => {
        const exists = selectedTargets.find(t => t.accountId === accountId);
        if (exists) {
            setSelectedTargets(selectedTargets.filter(t => t.accountId !== accountId));
        } else {
            setSelectedTargets([...selectedTargets, { accountId, captionTemplate: '{title}' }]);
        }
    };

    const updateTemplate = (accountId: number, template: string) => {
        setSelectedTargets(selectedTargets.map(t =>
            t.accountId === accountId ? { ...t, captionTemplate: template } : t
        ));
    };

    const handleSave = () => {
        if (!ruleName) return toast.error('Please name your rule');
        if (!sourceAccountId) return toast.error('Please select a source account');
        if (selectedTargets.length === 0) return toast.error('Please select at least one target');

        createMutation.mutate({
            name: ruleName,
            sourceAccountId,
            triggerType: 'new_upload',
            filters: { keywords },
            targets: selectedTargets
        });
    };

    // Filter accounts based on platform capabilities (only platforms with events can be sources)
    const sourceAccounts = accounts.filter((a: any) => {
        const platformConfig = PLATFORMS[a.platform as keyof typeof PLATFORMS];
        return platformConfig && platformConfig.hasEvents;
    });

    // Allow any account that is NOT the selected source account as a target
    const targetAccounts = accounts.filter((a: any) => a.accountId !== sourceAccountId);

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8">
            <header className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">Setup Workflow</h1>
            </header>

            {/* Stepper */}
            <div className="flex items-center justify-between px-4">
                {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === idx;
                    const isCompleted = currentStep > idx;

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-2 relative z-10">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                                isActive ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25" :
                                    isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                            </div>
                            <span className={cn(
                                "text-xs font-semibold uppercase tracking-wider",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}>
                                {step.title}
                            </span>
                        </div>
                    );
                })}
                {/* Connector Lines */}
                <div className="absolute top-[138px] left-[calc(50%-180px)] right-[calc(50%-180px)] h-[2px] bg-muted -z-0" />
            </div>

            <Card className="p-8 mt-12 min-h-[400px] flex flex-col bg-primary/5 border-primary/20">
                {/* Step 0: Source */}
                {currentStep === 0 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-2">
                            <Label className="text-xl">Pick Your Main</Label>
                            <p className="text-sm text-muted-foreground">Whenever you drop a banger on this channel, we'll blast it everywhere else.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {sourceAccounts.map((account: any) => (
                                <button
                                    key={account.accountId}
                                    onClick={() => setSourceAccountId(account.accountId)}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                                        sourceAccountId === account.accountId
                                            ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center p-2.5">
                                        <PlatformLogo platform={account.platform} className="text-primary" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-semibold truncate">{account.profileName}</div>
                                        <div className="text-xs text-muted-foreground truncate">{account.handle || account.platformUserId}</div>
                                    </div>
                                    {sourceAccountId === account.accountId && (
                                        <div className="w-6 h-6 rounded-full bg-primary text-slate-950 flex items-center justify-center">
                                            <Check size={14} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 1: Filters */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-2">
                            <Label className="text-xl">Add Filters (Optional)</Label>
                            <p className="text-sm text-muted-foreground">Only sync if the title hits certain keywords. Leave blank to sync every single drop.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g. #short, vlog, tutorial"
                                    value={currentKeyword}
                                    onChange={(e) => setCurrentKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                                />
                                <Button onClick={handleAddKeyword} variant="secondary">Add</Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {keywords.map(kw => (
                                    <div key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                        {kw}
                                        <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-primary/70">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {keywords.length === 0 && (
                                    <p className="text-sm italic text-muted-foreground">No filters added. All uploads will be synced.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Targets */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-2">
                            <Label className="text-xl">Choose the Dest. 🎯</Label>
                            <p className="text-sm text-muted-foreground">Where should this content land? Select your target platforms.</p>
                        </div>

                        <div className="space-y-4">
                            {targetAccounts.map((account: any) => {
                                const isSelected = selectedTargets.find(t => t.accountId === account.accountId);
                                return (
                                    <div key={account.accountId} className="space-y-3">
                                        <button
                                            onClick={() => toggleTarget(account.accountId)}
                                            className={cn(
                                                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                                                isSelected
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center p-2.5">
                                                <PlatformLogo platform={account.platform} className="text-primary" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-semibold truncate">{account.profileName}</div>
                                                <div className="text-xs text-muted-foreground truncate">{account.handle || account.platformUserId}</div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-6 h-6 rounded-full bg-primary text-slate-950 flex items-center justify-center">
                                                    <Check size={14} />
                                                </div>
                                            )}
                                        </button>

                                        {isSelected && (
                                            <div className="ml-14 space-y-2 animate-in slide-in-from-top-2">
                                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Caption Template</Label>
                                                <Input
                                                    value={isSelected.captionTemplate}
                                                    onChange={(e) => updateTemplate(account.accountId, e.target.value)}
                                                    placeholder="Use {title} for original title"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-2">
                            <Label className="text-xl">What's the play? (Name this rule)</Label>
                            <p className="text-sm text-muted-foreground">Give it a catchy name so you can track the workflow.</p>
                        </div>

                        <Input
                            placeholder="e.g. YouTube Shorts to LinkedIn"
                            value={ruleName}
                            onChange={(e) => setRuleName(e.target.value)}
                            className="text-lg h-12"
                        />

                        <div className="bg-muted/50 rounded-2xl p-6 space-y-4 border border-border">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Info size={18} className="text-primary" />
                                Rule at a Glance
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div>
                                    <div className="text-muted-foreground">Source Account</div>
                                    <div className="font-medium">{sourceAccounts.find((a: any) => a.accountId === sourceAccountId)?.profileName || 'None'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Target Platforms</div>
                                    <div className="font-medium">{selectedTargets.length} selected</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-muted-foreground">Keywords</div>
                                    <div className="font-medium">{keywords.length > 0 ? keywords.join(', ') : 'All uploads'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="mt-auto flex items-center justify-between pt-8 border-t border-border/50">
                    <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                    >
                        Back it up
                    </Button>

                    {currentStep < STEPS.length - 1 ? (
                        <Button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            disabled={
                                (currentStep === 0 && !sourceAccountId) ||
                                (currentStep === 2 && selectedTargets.length === 0)
                            }
                        >
                            Keep it movin'
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Activating...' : 'Activate ✨'}
                            <Zap size={18} className="ml-2 fill-current" />
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
