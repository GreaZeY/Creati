import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Target, Flag, ShieldAlert, Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useClient } from "@/context/ClientContext";
import { toast } from "@/lib/events";

export const IdentityManager = () => {
  const { selectedClient } = useClient();
  const [voice, setVoice] = useState("");
  const [audience, setAudience] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // In a real app, we'd fetch these from the client object
  // For now, we'll simulate local state for the demo
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call to update client metadata
      await new Promise((r) => setTimeout(r, 1000));
      toast.success(
        "Brand identity updated! AI will now generate content with this context.",
      );
    } catch (err) {
      toast.error("Failed to save identity");
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedClient) {
    return (
      <div className="p-12 text-center opacity-40">
        <p className="font-black uppercase tracking-widest text-[10px]">
          No Workspace Selected
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg tracking-tight">Brand Identity</h3>
          <p className="text-xs text-muted-foreground font-medium">
            Fine-tune how AI perceives and speaks for {selectedClient.name}.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 rounded-xl h-10 px-6 font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
        >
          {isSaving ? (
            "Syncing..."
          ) : (
            <>
              <Save size={14} />
              Save Identity
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <IdentityCard
          icon={<Sparkles size={18} className="text-purple-500" />}
          title="Brand Voice"
          subtitle="How should the AI sound? (e.g., Professional, Quirky, Elite)"
          value={voice}
          onChange={setVoice}
          placeholder="e.g. Sophisticated but accessible, focusing on reliability and innovation..."
        />

        <IdentityCard
          icon={<Target size={18} className="text-blue-500" />}
          title="Target Audience"
          subtitle="Who are we talking to? (e.g., CEOs, Gen Z Gamers)"
          value={audience}
          onChange={setAudience}
          placeholder="e.g. Tech-savvy professionals aged 25-45 looking for productivity gains..."
        />

        <IdentityCard
          icon={<ShieldAlert size={18} className="text-red-500" />}
          title="Avoid Keywords"
          subtitle="What language should never be used?"
          value={keywords}
          onChange={setKeywords}
          placeholder="e.g. Salesy, cheap, guaranteed, discount..."
        />
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex gap-4 items-start">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          <Flag size={20} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-primary mb-1 text-[10px] uppercase tracking-widest">
            Global AI Context
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            These settings are automatically injected into every AI prompt for
            this workspace. Use them to ensure consistent brand representation
            across all platforms.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const IdentityCard = ({
  icon,
  title,
  subtitle,
  value,
  onChange,
  placeholder,
}: any) => (
  <Card className="p-6 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl ring-1 ring-border rounded-3xl relative overflow-hidden group">
    <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
    <div className="flex gap-4 relative z-10">
      <div className="p-3 rounded-2xl bg-secondary/50 ring-1 ring-border/50 group-hover:rotate-3 transition-all">
        {icon}
      </div>
      <div className="flex-1 space-y-3">
        <div>
          <h4 className="font-bold text-sm tracking-tight">{title}</h4>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            {subtitle}
          </p>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-32 bg-secondary/10 dark:bg-black/20 border-0 ring-1 ring-border rounded-2xl p-4 text-xs font-medium focus:ring-primary/40 transition-all resize-none"
        />
      </div>
    </div>
  </Card>
);
