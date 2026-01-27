import { Modal } from "@/components/ui/Modal";
import { useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import {
  CheckCheck,
  Link as LinkIcon,
  Network,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLATFORMS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/features";

export const ConnectPlatforms = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const platformParam = searchParams.get("platform");
  const message = searchParams.get("message");

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const { limit } = useEntitlement();
  const maxAccounts = limit(CAPABILITIES.MAX_CONNECTED_ACCOUNTS);

  // Fetch counts and platform-wise connection status (lightweight endpoint)
  const { data: countsData = {} } = useQuery({
    queryKey: ["platforms-count"],
    queryFn: async () => {
      const response = await platformsAPI.getCount();
      return response.data.data;
    },
  });

  const connectedCount = countsData["total"] ?? 0;
  const isLimitReached = maxAccounts > 0 && connectedCount >= maxAccounts;

  const connectMutation = useMutation({
    mutationFn: async (platformId: string) => {
      const { data } = await platformsAPI.connect(platformId);
      const { authUrl } = data.data;
      if (authUrl) {
        window.location.href = authUrl;
      }
    },
  });

  const handleConnectClick = (platformId: string) => {
    // Show guidance for Meta platforms
    if (platformId === "instagram" || platformId === "facebook") {
      setSelectedPlatform(platformId);
    } else {
      // Direct connect for others (YouTube etc)
      connectMutation.mutate(platformId);
    }
  };

  const selectedPlatformName = selectedPlatform
    ? PLATFORMS[selectedPlatform as keyof typeof PLATFORMS]?.name
    : "";

  return (
    <div className="max-w-5xl space-y-8 pb-10">
      {/* ... (Header) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Network size={18} />
              </span>
              <span className="text-4xl font-black uppercase text-primary">
                Ecosystem Expansion
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-lg font-medium opacity-80">
              Link new delivery nodes to broadcast your message across the
              digital fabric.
            </p>
          </div>
        </div>
      </div>

      {/* Guidance Modal */}
      <Modal
        isOpen={!!selectedPlatform}
        onClose={() => setSelectedPlatform(null)}
        title={`Connect ${selectedPlatformName}`}
      >
        <div className="space-y-6">
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
            <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
              <Zap size={16} />
              Pre-Flight Checklist
            </h4>
            <p className="text-sm text-muted-foreground">
              To ensure a successful connection with{" "}
              <strong>{selectedPlatformName}</strong>, please confirm the
              following:
            </p>
          </div>

          <ul className="space-y-4">
            {selectedPlatform === "instagram" && (
              <>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <span>
                    Your Instagram account must be a{" "}
                    <strong className="text-foreground">Business</strong> or{" "}
                    <strong className="text-foreground">Creator</strong>{" "}
                    account. Personal accounts cannot publish content via API.
                  </span>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <span>
                    Your Instagram account must be linked to a{" "}
                    <strong className="text-foreground">Facebook Page</strong>.
                  </span>
                </li>
              </>
            )}
            {selectedPlatform === "facebook" && (
              <>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <span>
                    You are connecting a{" "}
                    <strong className="text-foreground">Facebook Page</strong>,
                    not a personal profile.
                  </span>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <span>
                    You have <strong className="text-foreground">Admin</strong>{" "}
                    access to the Page.
                  </span>
                </li>
              </>
            )}
            <li className="flex gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-xs">
                !
              </div>
              <span>
                During the Facebook login popup, please{" "}
                <strong className="text-foreground">
                  Grant All Permissions
                </strong>
                . Unchecking boxes will cause the connection to fail.
              </span>
            </li>
          </ul>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setSelectedPlatform(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 font-bold"
              onClick={() => {
                if (selectedPlatform) {
                  connectMutation.mutate(selectedPlatform);
                  setSelectedPlatform(null);
                }
              }}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending
                ? "Connecting..."
                : "I Understand, Connect"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ... (Rest of UI) */}

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="bg-destructive/10 border-2 border-destructive/20 p-6 rounded-3xl flex items-center gap-5 shadow-2xl shadow-destructive/10 backdrop-blur-md"
          >
            {/* ... */}
            <div className="p-3 bg-destructive rounded-2xl text-white shadow-lg shadow-destructive/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-destructive capitalize leading-none">
                Connection Failed
              </h3>
              <p className="text-destructive/80 font-bold text-sm mt-1">
                {message ||
                  "An unknown error occurred while connecting the platform."}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="ml-auto rounded-xl hover:bg-destructive/10 text-destructive font-bold"
            >
              <Link to="/connect">Dismiss</Link>
            </Button>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="bg-emerald-500/10 border-2 border-emerald-500/20 p-6 rounded-3xl flex items-center gap-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-md"
          >
            <div className="p-3 bg-emerald-500 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/20">
              <CheckCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-emerald-500 capitalize leading-none">
                Connected {platformParam}!
              </h3>
              <p className="text-emerald-500/80 font-bold text-sm mt-1">
                Your account is now ready for unified publishing.
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="ml-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-bold text-slate-950"
            >
              <Link to="/platforms">My Platforms</Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {isLimitReached && (
          <div className="md:col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                Account Limit Reached ({connectedCount}/{maxAccounts})
              </p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                You've connected the maximum number of accounts for your plan.
                Upgrade to connect more platforms.
              </p>
            </div>
          </div>
        )}
        {Object.values(PLATFORMS).map((platform: any, i: number) => {
          const isSyncing =
            connectMutation.isPending &&
            connectMutation.variables === platform.id;

          // Re-evaluate disabled state
          const finalDisabled =
            !platform.enabled || isSyncing || isLimitReached;

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 100 }}
            >
              <Card className="p-8 bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/50 transition-all duration-500 group relative overflow-hidden rounded-[2rem] ring-1 ring-white/5 shadow-2xl hover:shadow-primary/5">
                <div className="flex items-start gap-6 relative z-10">
                  <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl">
                    <PlatformLogo platform={platform.id} size={40} />
                  </div>

                  <div className="flex-1 space-y-2">
                    <h3 className="text-2xl font-black tracking-tight">
                      {platform.name}
                    </h3>
                    <p className="text-muted-foreground/80 font-medium mb-6 line-clamp-2 text-sm leading-relaxed">
                      Seamlessly link your {platform.name} account to automate
                      content distribution.
                    </p>

                    <div className="pt-4 flex items-center gap-4">
                      <Button
                        onClick={() => handleConnectClick(platform.id)} // Changed handler
                        disabled={finalDisabled}
                        variant="default"
                        className="h-12 px-10 rounded-2xl font-black transition-all"
                      >
                        {isSyncing
                          ? "Linking..."
                          : isLimitReached
                            ? "Limit Reached"
                            : `Link ${platform.name}`}
                      </Button>

                      {platform.enabled && (
                        <div className="flex items-center gap-1.5 text-[10px] text-primary/60 font-black uppercase tracking-[0.2em]">
                          <Zap
                            size={14}
                            className="text-primary fill-primary"
                          />
                          One-Tap
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!platform.enabled && (
                  // ... disabled UI kept same
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-[16px] flex items-center justify-center p-8 text-center z-20 rounded-[2rem] transition-all duration-500 border border-white/5">
                    <div className="space-y-4">
                      <div className="bg-primary/20 text-primary px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest w-fit mx-auto shadow-lg shadow-primary/10 ring-1 ring-primary/20">
                        Coming Soon
                      </div>
                      <p className="text-sm font-bold text-foreground/80 leading-relaxed max-w-[200px]">
                        Integration for {platform.name} is arriving in a future
                        update.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ... Footer Card kept same */}
      <Card className="p-8 border-primary/20 bg-primary/[0.02] mt-10 rounded-3xl relative overflow-hidden group">
        {/* ... */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/10 transition-colors" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="p-5 rounded-2xl bg-primary/10 text-primary">
            <LinkIcon size={32} />
          </div>
          <div className="text-center md:text-left flex-1 space-y-2">
            <h4 className="text-xl font-bold">Why link multiple accounts?</h4>
            <p className="text-muted-foreground max-w-xl">
              Our intelligent distribution engine automatically reformats and
              optimizes your video for each platform's specific audiences and
              algorithms.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-black text-primary">2.4x</div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                Reach
              </div>
            </div>
            <div className="w-[1px] h-10 bg-border/50" />
            <div className="text-center">
              <div className="text-2xl font-black text-primary">0</div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                Extra Work
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
