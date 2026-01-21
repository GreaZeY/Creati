import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Zap,
    Pause,
    Play,
    Trash2,
    ArrowRight,
    Clock,
    Youtube
} from 'lucide-react';
import { automationAPI } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/events';

interface AutomationRule {
    id: number;
    name: string;
    sourceAccountId: number;
    triggerType: string;
    filters: any;
    targets: any[];
    isActive: boolean;
    lastRunAt: string | null;
    createdAt: string;
}

export function Automation() {
    const queryClient = useQueryClient();
    const { data: rules = [], isLoading } = useQuery({
        queryKey: ['automation-rules'],
        queryFn: async () => {
            const resp = await automationAPI.list();
            return resp.data.data || [];
        }
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
            automationAPI.toggle(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success('Status updated. ✨');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => automationAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
            toast.success('Magic removed.');
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Magic Sync</h1>
                    <p className="text-muted-foreground mt-1">Blast your content across platforms automatically. No cap. 🚀</p>
                </div>
                <Link to="/automation/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        New Magic
                    </Button>
                </Link>
            </header>

            {rules.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed bg-primary/5">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Zap className="text-primary" size={32} />
                    </div>
                    <h3 className="text-xl font-semibold italic">A bit quiet in here... 👻</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm">
                        Turn one upload into a viral spree. Sync your YouTube heat to Insta, LinkedIn & more.
                    </p>
                    <Link to="/automation/new" className="mt-6">
                        <Button className="gap-2">
                            <Plus size={18} />
                            Let's Cook
                        </Button>
                    </Link>
                </Card>
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
                                <Card className={cn(
                                    "group relative p-6 transition-all duration-300 overflow-hidden",
                                    !rule.isActive && "opacity-75 grayscale-[0.5]"
                                )}>
                                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                                        {/* Status Icon */}
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                            rule.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                        )}>
                                            <Zap size={24} fill={rule.isActive ? "currentColor" : "none"} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg truncate">{rule.name}</h3>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                    rule.isActive ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {rule.isActive ? 'Active' : 'Paused'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Youtube size={14} className="text-[#FF0000]" />
                                                    <span>YouTube Source</span>
                                                </div>
                                                <ArrowRight size={14} />
                                                <div className="flex items-center gap-1.5">
                                                    <span>{(rule.targets as any[]).length} Targets</span>
                                                </div>
                                                {rule.lastRunAt && (
                                                    <div className="flex items-center gap-1.5 border-l border-border pl-4 ml-2">
                                                        <Clock size={14} />
                                                        <span>Last run: {new Date(rule.lastRunAt).toLocaleDateString()}</span>
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
                                                onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                                            >
                                                {rule.isActive ? (
                                                    <><Pause size={16} className="mr-2" /> Pause</>
                                                ) : (
                                                    <><Play size={16} className="mr-2" /> Resume</>
                                                )}
                                            </Button>

                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this rule?')) {
                                                        deleteMutation.mutate(rule.id);
                                                    }
                                                }}
                                                className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/5"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress/Stats Bar */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full overflow-hidden">
                                        {rule.isActive && (
                                            <motion.div
                                                className="h-full bg-primary"
                                                animate={{ x: ["-100%", "100%"] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                            />
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
