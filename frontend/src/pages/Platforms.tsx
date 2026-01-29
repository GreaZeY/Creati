import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import {
  Plus,
  Link2,
  MoreVertical,
  ShieldOff,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LensedCard } from "@/components/ui/LensedCard";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { DropdownMenu, DropdownItem } from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { toast } from "@/lib/events";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/features";

interface PlatformData {
  accountId?: number;
  id: string; // unique ID (accountID or platform name)
  name: string;
  platform: string;
  connected: boolean;
  profileName?: string;
  platformUserId?: string;
  handle?: string;
}

const PLATFORM_ACCENTS: Record<string, string> = {
  youtube: "text-red-500 border-red-500/20",
  instagram: "text-pink-500 border-pink-500/20",
  facebook: "text-blue-500 border-blue-500/20",
  linkedin: "text-cyan-600 border-cyan-600/20",
  twitter: "text-sky-400 border-sky-400/20",
};

export const Platforms = () => {
  const queryClient = useQueryClient();
  const { limit } = useEntitlement();
  const maxAccounts = limit(CAPABILITIES.MAX_CONNECTED_ACCOUNTS);

  const { data: platformStats = [], isLoading } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const response = await platformsAPI.list();
      return response.data.data as PlatformData[];
    },
  });

  const connectedCount = platformStats.filter((p) => p.connected).length;
  const isLimitReached = maxAccounts > 0 && connectedCount >= maxAccounts;

  const connectMutation = useMutation({
    mutationFn: async (platformId: string) => {
      const { data } = await platformsAPI.connect(platformId);
      const { authUrl } = data.data;
      if (authUrl) {
        window.location.assign(authUrl);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to initiate reconnection.");
    },
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: "disconnect" | "remove" | null;
    platformId: string | null;
    platformName: string | null;
  }>({
    isOpen: false,
    type: null,
    platformId: null,
    platformName: null,
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platformId: string) => {
      await platformsAPI.disconnect(platformId);
    },
    onSuccess: (_, platformId) => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      toast.success(`${platformId} account disconnected.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disconnect account.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (platformId: string) => {
      await platformsAPI.remove(platformId);
    },
    onSuccess: (_, platformId) => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      toast.success(`${platformId} account removed.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove platform.");
    },
  });

  const handleConfirm = () => {
    if (!confirmState.platformId || !confirmState.type) return;

    if (confirmState.type === "disconnect") {
      disconnectMutation.mutate(confirmState.platformId);
    } else {
      removeMutation.mutate(confirmState.platformId);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleReconnect = (platformId: string) => {
    connectMutation.mutate(platformId);
  };

  return (
    <div className="space-y-12 pb-20 max-w-7xl mx-auto px-4 font-outfit">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl font-black tracking-tighter uppercase italic font-outfit"
          >
            Active Nodes
          </motion.h1>
          <p className="text-muted-foreground text-xl font-medium max-w-lg">
            Manage your neural distribution network. Authenticate new nodes to
            expand your reach.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {isLimitReached ? (
            <div className="flex flex-col items-end gap-2">
              <Button
                disabled
                className="h-16 px-10 rounded-2xl bg-white/5 text-muted-foreground font-black text-lg opacity-50 cursor-not-allowed border-0"
              >
                NODE LIMIT REACHED
              </Button>
              <Link
                to="/pricing"
                className="text-xs text-primary font-black uppercase tracking-widest hover:underline"
              >
                Upgrade Plan →
              </Link>
            </div>
          ) : (
            <Button
              asChild
              size="lg"
              className="h-16 px-10 rounded-2xl bg-primary text-slate-950 font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(var(--primary),0.3)] group border-0"
            >
              <Link to="/platforms/connect" className="flex items-center gap-3">
                <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 duration-500" />
                <span>LINK NEW NODE</span>
              </Link>
            </Button>
          )}
        </motion.div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <PlatformSkeleton key={i} />
          ))}
        </div>
      ) : platformStats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {platformStats.map((platform: PlatformData, i: number) => {
              const accentClass =
                PLATFORM_ACCENTS[platform.platform] ||
                "text-primary border-primary/20";

              return (
                <motion.div
                  key={platform.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    transition: { duration: 0.2 },
                  }}
                  transition={{ delay: i * 0.05 }}
                  className="w-full"
                >
                  <LensedCard
                    className={cn(
                      "p-6 relative flex flex-row items-center gap-6",
                      !platform.connected && "opacity-60",
                    )}
                  >
                    {/* Dropdown Menu */}
                    <div className="absolute top-4 right-4 z-20">
                      <DropdownMenu
                        trigger={
                          <button className="p-2 rounded-xl text-muted-foreground/40 hover:text-foreground hover:bg-white/5 transition-all">
                            <MoreVertical size={18} />
                          </button>
                        }
                      >
                        {platform.connected && (
                          <DropdownItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmState({
                                isOpen: true,
                                type: "disconnect",
                                platformId: platform.id,
                                platformName: platform.name,
                              });
                            }}
                          >
                            <ShieldOff size={16} />
                            Offline Mode
                          </DropdownItem>
                        )}
                        <DropdownItem
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmState({
                              isOpen: true,
                              type: "remove",
                              platformId: platform.id,
                              platformName: platform.name,
                            });
                          }}
                        >
                          <Trash2 size={16} />
                          Purge Node
                        </DropdownItem>
                      </DropdownMenu>
                    </div>

                    <div
                      className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl ring-1 ring-white/5 bg-white/5",
                        accentClass.split(" ")[1],
                      )}
                    >
                      <PlatformLogo
                        platform={platform.platform}
                        size={32}
                        className={accentClass.split(" ")[0]}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black tracking-tighter uppercase italic truncate">
                          {platform.profileName || platform.name}
                        </h3>
                        {platform.connected ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest ring-1 ring-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            Active
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest ring-1 ring-amber-500/20">
                            <AlertTriangle size={10} />
                            Offline
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 font-black uppercase tracking-[0.2em] opacity-40">
                        {platform.platform}{" "}
                        {platform.handle ? `// ${platform.handle}` : ""}
                      </p>
                    </div>

                    {!platform.connected && (
                      <Button
                        onClick={() => handleReconnect(platform.id)}
                        isLoading={
                          connectMutation.isPending &&
                          connectMutation.variables === platform.id
                        }
                        className="h-10 px-6 rounded-xl bg-primary text-slate-950 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        Reconnect
                      </Button>
                    )}
                  </LensedCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <LensedCard className="py-32 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/5">
          <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 ring-1 ring-white/10 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700">
            <Link2 className="w-12 h-12 text-primary opacity-40" />
          </div>

          <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
            Ecosystem Standby
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-lg font-medium opacity-60">
            Your distribution network is waiting for its first node. Connect a
            platform to begin the blast.
          </p>

          <Button
            asChild
            size="lg"
            className="mt-12 h-16 px-12 rounded-2xl bg-primary text-slate-950 font-black text-lg hover:scale-105 active:scale-95 transition-all"
          >
            <Link to="/platforms/connect">AUTH FIRST NODE</Link>
          </Button>
        </LensedCard>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirm}
        title={
          confirmState.type === "disconnect" ? "TERMINATE LINK?" : "PURGE NODE?"
        }
        description={
          confirmState.type === "disconnect"
            ? `This will sever the real-time uplink for ${confirmState.platformName}. No automated broadcasts will be possible.`
            : `This will permanently delete the node ${confirmState.platformName} and all stored credentials. IRREVERSIBLE.`
        }
        confirmText={
          confirmState.type === "disconnect" ? "Sever Link" : "Purge Permanent"
        }
        variant={confirmState.type === "disconnect" ? "warning" : "danger"}
        isLoading={disconnectMutation.isPending || removeMutation.isPending}
      />
    </div>
  );
};

const PlatformSkeleton = () => {
  return (
    <LensedCard className="p-8 h-[140px] flex items-center gap-8">
      <Skeleton className="w-20 h-20 rounded-2xl bg-white/5" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-2/3 rounded-xl bg-white/5" />
        <Skeleton className="h-4 w-1/3 rounded-lg bg-white/5 opacity-50" />
      </div>
    </LensedCard>
  );
};
