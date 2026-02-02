import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { LensedCard } from "@/components/ui/LensedCard";
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionLink,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <LensedCard className={`py-32 flex flex-col items-center justify-center text-center border-dashed border-2 border-border ${className}`}>
      <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mb-8 ring-1 ring-border group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700">
        <Icon className="text-primary opacity-40 blur-[1px]" size={48} />
      </div>
      <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
        {title}
      </h3>
      <p className="text-muted-foreground font-medium max-w-md text-lg opacity-60">
        {description}
      </p>

      {actionLabel && (
        <div className="mt-12">
          {actionLink ? (
            <Link to={actionLink}>
              <Button className="h-16 px-12 rounded-2xl bg-foreground text-background font-black text-lg hover:scale-105 active:scale-95 transition-all uppercase">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="h-16 px-12 rounded-2xl bg-foreground text-background font-black text-lg hover:scale-105 active:scale-95 transition-all uppercase"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </LensedCard>
  );
}
