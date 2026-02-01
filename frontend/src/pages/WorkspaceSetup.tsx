import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agencyAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { Rocket, Sparkles, Briefcase } from "lucide-react";

export const WorkspaceSetup = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshClients, selectClient } = useClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const resp = await agencyAPI.createClient(name);
      await refreshClients();
      // Select the newly created client
      if (resp.data.data) {
        selectClient(resp.data.data as any);
      }
      navigate("/platforms"); // Go to connect platforms next
    } catch (err) {
      // toast handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-outfit">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 ring-1 ring-primary/20 shadow-2xl">
            <Rocket className="w-10 h-10 text-primary blur-[0.5px]" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic mb-4">
            Initialize <span className="text-primary">Workspace</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-sm mx-auto font-medium opacity-60">
            Every distribution engine needs a name. What are we building today?
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-border shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px]" />

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-2">
                Workspace Identity
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </label>
              <div className="relative">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Global Network"
                  className="h-16 px-8 rounded-2xl bg-muted/30 border-border focus:ring-primary/20 text-xl font-black placeholder:text-muted-foreground/20"
                  autoFocus
                  required
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
                  <Briefcase size={20} />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-16 rounded-2xl font-black text-lg shadow-2xl shadow-primary/30 bg-gradient-to-r from-primary to-cyan-500 hover:scale-[1.02] active:scale-95 transition-all"
              isLoading={loading}
              loadingText="Initializing..."
            >
              LAUNCH ENGINE
            </Button>
          </form>
        </div>

        <p className="text-center mt-12 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          The core is ready for dispatch. Pro-tier isolation enabled.
        </p>
      </motion.div>
    </div>
  );
};
