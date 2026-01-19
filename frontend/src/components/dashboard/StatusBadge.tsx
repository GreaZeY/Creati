import { cn } from '@/lib/utils';
import { CheckCircle2, CircleDashed, Clock, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
    const config = {
        pending: {
            color: 'bg-amber-500/10 text-amber-500',
            icon: Clock,
            label: 'Pending',
        },
        processing: {
            color: 'bg-primary/10 text-primary',
            icon: CircleDashed,
            label: 'Processing',
            animate: 'animate-spin',
        },
        completed: {
            color: 'bg-emerald-500/10 text-emerald-500',
            icon: CheckCircle2,
            label: 'Uploaded',
        },
        failed: {
            color: 'bg-destructive/10 text-destructive',
            icon: AlertCircle,
            label: 'Failed',
        },
    }[status] || {
        color: 'bg-muted text-muted-foreground',
        icon: Clock,
        label: status,
    };

    const Icon = config.icon;

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            config.color,
            className
        )}>
            <Icon className={cn("w-3.5 h-3.5", config.animate)} />
            {config.label}
        </div>
    );
};
