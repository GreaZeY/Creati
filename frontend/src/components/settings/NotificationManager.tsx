import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agencyAPI } from "@/lib/api";
import type { AlertPhone } from "@/lib/api";
import { toast } from "@/lib/events";
import {
  Bell,
  Plus,
  Trash2,
  Info,
  Save,
  Phone,
  MessageSquare,
  Zap,
} from "lucide-react";

export const NotificationManager = () => {
  const [phones, setPhones] = useState<AlertPhone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await agencyAPI.getWhatsAppAlerts();
      if (response.data.success) {
        setPhones(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setPhones([...phones, { label: "", phone: "" }]);
  };

  const handleDelete = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const handleChange = (
    index: number,
    field: keyof AlertPhone,
    value: string,
  ) => {
    const newPhones = [...phones];
    newPhones[index] = { ...newPhones[index], [field]: value };
    setPhones(newPhones);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate: labels and phones must not be empty
      const validPhones = phones.filter((p) => p.phone.trim() !== "");

      const response = await agencyAPI.updateWhatsAppAlerts(validPhones);
      if (response.data.success) {
        toast.success("Notification settings saved successfully");
        setPhones(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to save alerts:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-black uppercase tracking-widest text-primary/80">
          WhatsApp Failure Alerts
        </h2>
        <p className="text-xs text-muted-foreground font-medium">
          Configure phone numbers to receive instant alerts when distribution
          jobs fail.
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {phones.map((alert, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              layout
            >
              <Card className="p-4 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl ring-1 ring-border/50 group hover:ring-primary/20 transition-all rounded-2xl">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 ml-1">
                      Label (e.g. Manager)
                    </label>
                    <Input
                      placeholder="Agency Manager"
                      value={alert.label}
                      onChange={(e) =>
                        handleChange(index, "label", e.target.value)
                      }
                      className="bg-background/20 border-border/30 focus:border-primary/50 transition-all rounded-xl h-10"
                    />
                  </div>
                  <div className="flex-[1.5] space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 ml-1">
                      Phone Number (E.164 format)
                    </label>
                    <div className="relative">
                      <Input
                        placeholder="+1234567890"
                        value={alert.phone}
                        onChange={(e) =>
                          handleChange(index, "phone", e.target.value)
                        }
                        className="bg-background/20 border-border/30 focus:border-primary/50 transition-all rounded-xl pl-10 h-10"
                      />
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    </div>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(index)}
                      className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive h-10 w-10 ring-1 ring-transparent hover:ring-destructive/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {phones.length === 0 && !isLoading && (
          <Card className="p-8 border-dashed border-2 border-border/50 bg-transparent rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 rounded-full bg-secondary/50 ring-1 ring-border/50">
              <MessageSquare className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-muted-foreground">
                No alert numbers configured
              </p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                Add numbers to receive instant interactive alerts with retry
                capabilities.
              </p>
            </div>
          </Card>
        )}

        <div className="flex flex-col md:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleAdd}
            className="rounded-xl ring-1 ring-border/50 border-0 bg-white/20 dark:bg-card/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-card/40 transition-all flex-1 h-11 font-bold tracking-tight"
          >
            <Plus className="w-4 h-4 mr-2 text-primary" />
            Add Contact
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="rounded-xl bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex-1 h-11 font-bold text-white tracking-tight"
          >
            {isSaving ? (
              <Zap className="w-4 h-4 mr-2 animate-pulse" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-primary/5 border-0 ring-1 ring-primary/20 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse" />
        <div className="flex gap-4 relative z-10">
          <div className="mt-0.5">
            <div className="p-1.5 rounded-lg bg-primary/10 ring-1 ring-primary/30">
              <Info className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-primary tracking-tight uppercase">
              Platform Power-Up
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              Interactive WhatsApp alerts allow you to retry failed jobs
              directly from the message with a single tap. Ensure phone numbers
              include the plus (+) and country code for reliable delivery.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
