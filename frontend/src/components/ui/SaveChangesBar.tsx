import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button"; // Assuming Button exists here
import { Card } from "@/components/ui/Card"; // Assuming Card exists here
import { cn } from "@/lib/utils";

interface SaveChangesBarProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  shake?: boolean; // Signal to trigger shake
}

export const SaveChangesBar = ({
  isDirty,
  isSaving,
  onSave,
  onDiscard,
  shake = false,
}: SaveChangesBarProps) => {
  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{
            x: shake ? [0, -15, 15, -15, 15, -5, 5, 0] : 0,
            y: 0,
            opacity: 1,
            transition: {
              x: shake
                ? { type: "tween", duration: 0.4, ease: "easeInOut" }
                : {},
              y: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            },
          }}
          exit={{ y: 20, opacity: 0 }}
          className="fixed bottom-6 left-[35%] -translate-x-1/2 z-[100] w-1/2 px-2"
        >
          <Card
            className={cn(
              "p-2 bg-background/80 backdrop-blur-2xl border-primary/20 shadow-2xl ring-1 ring-primary/20 flex items-center justify-between gap-3 rounded-xl transition-all duration-300",
              shake &&
                "border-destructive/50 ring-destructive/50 bg-destructive/5",
            )}
          >
            <div className="pl-2 flex items-center gap-2">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="dot"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                  />
                </AnimatePresence>
              </div>
              <p
                className={cn(
                  "text-[9px] font-black uppercase tracking-[0.2em] transition-colors",
                  shake ? "text-destructive" : "text-primary",
                )}
              >
                Unsaved Changes
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onDiscard}
                disabled={isSaving}
                className="h-8 px-3 rounded-lg font-bold uppercase tracking-widest text-[9px]"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="h-8 px-4 rounded-lg font-bold uppercase tracking-widest text-[9px] bg-primary shadow-lg shadow-primary/25"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
