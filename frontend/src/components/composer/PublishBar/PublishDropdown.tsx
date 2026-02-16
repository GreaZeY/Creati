import { useState, useRef } from "react";
import { ChevronDown, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popper } from "@/components/ui/Popper";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PublishDropdownProps {
  onPublishNow: () => void;
  onSchedule: () => void;
  disabled?: boolean;
  label?: string;
}

export function PublishDropdown({
  onPublishNow,
  onSchedule,
  disabled,
  label = "Publish",
}: PublishDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handlePublishNow = () => {
    onPublishNow();
    setIsOpen(false);
  };

  const handleSchedule = () => {
    onSchedule();
    setIsOpen(false);
  };

  return (
    <>
      <Button
        ref={triggerRef}
        size="sm"
        className="h-9 px-4 gap-2"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Send size={14} />
        {label}
        <ChevronDown size={14} />
      </Button>

      <Popper
        anchorEl={triggerRef.current}
        open={isOpen}
        onClickAway={() => setIsOpen(false)}
        placement="bottom-end"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              className="w-48 bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden py-1"
            >
              <button
                onClick={handlePublishNow}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5",
                  "hover:bg-accent/10 text-sm font-medium text-left",
                  "transition-colors",
                )}
              >
                <Send size={14} />
                Publish Now
              </button>
              <button
                onClick={handleSchedule}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5",
                  "hover:bg-accent/10 text-sm font-medium text-left",
                  "transition-colors",
                )}
              >
                <Clock size={14} />
                Schedule
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Popper>
    </>
  );
}
