import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Save,
  UserCheck,
  Megaphone,
  Target,
  BrainCircuit,
  Type,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { LensedCard } from "@/components/ui/LensedCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useClient } from "@/context/ClientContext";
import { toast } from "@/lib/events";
import { api, agencyAPI } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface VariationsResponse {
  output: string;
}

export const CreativeLab = () => {
  const { selectedClient } = useClient();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [constraints, setConstraints] = useState("");
  const [variations, setVariations] = useState<string[]>([]);

  // Fetch current client's profile to prepopulate settings
  useQuery({
    queryKey: ["clientProfile", selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient?.id) return null;
      const res = await agencyAPI.getClient(selectedClient.id);
      const data = res.data.data;
      if (data) {
        setBrandVoice(data.brandVoice || "");
        setTargetAudience(data.targetAudience || "");
        setConstraints(data.avoidKeywords || "");
      }
      return data;
    },
    enabled: !!selectedClient?.id,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: VariationsResponse }>(
        "/ai/creative-lab/generate",
        {
          prompt,
          brandVoice,
          targetAudience,
          constraints,
        },
      );
      return res.data.data.output;
    },
    onSuccess: (data) => {
      // The AI returns variations separated by '---'
      setVariations(
        data
          .split("---")
          .map((v) => v.trim())
          .filter(Boolean),
      );
      toast.success("Generation complete");
    },
    onError: () => toast.error("Failed to generate variations"),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient?.id) return;
      return agencyAPI.updateClient(selectedClient.id, {
        brandVoice,
        targetAudience,
        avoidKeywords: constraints,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clientProfile", selectedClient?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Brand Profile saved to Client settings");
    },
    onError: () => toast.error("Failed to save Brand Profile"),
  });

  return (
    <div className="h-full flex flex-col space-y-6 pb-12 max-w-7xl mx-auto px-8 w-full">
      <PageHeader
        title="Creative Lab"
        description="Dial in your client's brand voice and test AI-generated messaging personas."
      >
        <div className="flex items-center gap-3">
          {selectedClient && (
            <div
              className="px-3 py-1.5 rounded-full text-xs font-black text-white flex items-center gap-2"
              style={{ backgroundColor: selectedClient.color || "#7c3aed" }}
            >
              <UserCheck size={14} />
              {selectedClient.name}
            </div>
          )}
          <Button
            onClick={() => saveProfileMutation.mutate()}
            disabled={!selectedClient || saveProfileMutation.isPending}
            variant="outline"
            className="rounded-xl h-10 px-5 font-bold"
          >
            <Save size={14} className="mr-2" />
            {saveProfileMutation.isPending
              ? "Saving..."
              : "Save to Client Profile"}
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Col: Configuration */}
        <LensedCard className="lg:col-span-4 p-6 flex flex-col space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-sm font-black tracking-tight mb-1 flex items-center gap-2">
              <BrainCircuit size={16} className="text-primary" />
              Persona Engineering
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure how the AI should sound.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Megaphone size={12} /> Brand Voice & Tone
              </label>
              <textarea
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. Professional yet witty, uses tech-startup jargon sparingly, confident."
                className="w-full h-24 bg-secondary/30 border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Target size={12} /> Target Audience
              </label>
              <textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. B2B SaaS founders, Marketing Directors seeking automation..."
                className="w-full h-20 bg-secondary/30 border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <FileText size={12} /> Hard Constraints & Avoid Words
              </label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. No emojis, avoid 'revolutionary'"
                className="w-full bg-secondary/30 border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </LensedCard>

        {/* Right Col: Playground & Output */}
        <LensedCard className="lg:col-span-8 p-0 flex flex-col bg-background/50 overflow-hidden relative">
          <div className="p-6 border-b border-white/5 dark:border-white/5 space-y-4 shrink-0">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Type size={12} /> What should we talk about?
              </label>
              <div className="flex gap-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (prompt.trim()) generateMutation.mutate();
                    }
                  }}
                  placeholder="Draft a post announcing our new automated client invoicing feature..."
                  className="w-full h-14 bg-card border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary shadow-inner"
                />
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!prompt.trim() || generateMutation.isPending}
                  className="h-14 px-6 rounded-xl font-black shrink-0 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-pink opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center gap-2">
                    <Sparkles size={16} />
                    {generateMutation.isPending ? "Generating..." : "Generate"}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {generateMutation.isPending ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-secondary/20 border border-border space-y-3"
                  >
                    <Skeleton className="h-4 w-1/4 rounded bg-primary/20" />
                    <Skeleton className="h-3 w-5/6 rounded" />
                    <Skeleton className="h-3 w-4/6 rounded" />
                  </div>
                ))}
              </div>
            ) : variations.length > 0 ? (
              <div className="space-y-6">
                <AnimatePresence>
                  {variations.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow group relative"
                    >
                      <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black shadow-lg">
                        {i + 1}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {text}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <BrainCircuit
                  size={48}
                  className="mb-4 text-muted-foreground"
                />
                <p className="text-sm font-bold">Awaiting Input</p>
                <p className="text-xs max-w-xs mt-2">
                  Configure your persona and enter a topic to generate tailored
                  variations.
                </p>
              </div>
            )}
          </div>
        </LensedCard>
      </div>
    </div>
  );
};
