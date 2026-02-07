import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComposerAccordionProps {
  title: string;
  icon?: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function ComposerAccordion({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  className,
}: ComposerAccordionProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:bg-primary/20 transition-colors">
              <Icon size={16} />
            </div>
          )}
          <h3 className="text-sm font-bold uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-border/20">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
