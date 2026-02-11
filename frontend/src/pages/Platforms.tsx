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
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { toast } from "@/lib/events";
import { useEntitlement } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/features";
import { useClient } from "@/context/ClientContext";

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

  const { selectedClient } = useClient();

  const { data: platformStats = [], isLoading } = useQuery({
    queryKey: ["platforms", selectedClient?.id],
    queryFn: async () => {
      const response = await platformsAPI.list(selectedClient?.id);
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
    <div className="h-full overflow-y-auto space-y-6 pb-8 max-w-7xl mx-auto px-4 font-outfit w-full">
      <PageHeader
        title="My Platforms"
        description="Your connected neural pathways across the digital workspace."
      >
        {isLimitReached ? (
          <div className="flex flex-col items-end gap-2">
            <Button
              disabled
              className="h-11 px-6 rounded-xl bg-muted text-muted-foreground font-bold text-sm opacity-50 cursor-not-allowed border-0"
            >
              LIMIT REACHED
            </Button>
            <Link
              to="/pricing"
              className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline"
            >
              Upgrade Plan →
            </Link>
          </div>
        ) : (
          <Link to="/platforms/connect">
            <Button className="gap-2">
              <Plus size={18} />
              Connect New
            </Button>
          </Link>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <PlatformSkeleton key={i} />
          ))}
        </div>
      ) : platformStats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {platformStats.map((platform: PlatformData, i: number) => {
              const accentClass =
                PLATFORM_ACCENTS[platform.platform] ||
                "text-primary border-primary/20";

              return (
                <motion.div
                  key={platform.id}
                  layout
                  // initial={{ opacity: 0, y: 20 }}
                  // animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    // transition: { duration: 0.2 },
                  }}
                  transition={{ delay: i * 0.05 }}
                  className="w-full"
                >
                  <LensedCard
                    key={platform.id}
                    className={cn(
                      "p-6 relative flex flex-col gap-6 bg-white/50 dark:bg-card/40 border-0 ring-1 ring-slate-200 dark:ring-glass-border hover:ring-neon-purple/50 dark:hover:ring-neon-purple/50 hover:bg-white dark:hover:bg-card/60 transition-all duration-300 shadow-sm hover:shadow-glass group rounded-[2rem]",
                      !platform.connected && "opacity-60",
                    )}
                  >
                    {/* Dropdown Menu - Absolute Top Right */}
                    <div className="absolute top-4 right-4 z-20">
                      <DropdownMenu
                        trigger={
                          <button className="p-2 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                            <MoreVertical size={16} />
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
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm group-hover:scale-110 transition-transform duration-500">
                          <PlatformLogo
                            platform={platform.platform}
                            className="w-8 h-8 opacity-80 group-hover:opacity-100"
                          />
                        </div>
                        <div>
                          <h3 className="font-black text-lg tracking-tight text-slate-900 dark:text-white capitalize leading-none">
                            {platform.platform}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                platform.connected
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                  : "bg-slate-300 dark:bg-slate-600",
                              )}
                            />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-muted-foreground/60">
                              {platform.connected
                                ? "Live Node"
                                : "Disconnected"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto relative z-10">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-black text-slate-400 dark:text-muted-foreground/40 uppercase tracking-widest mb-1">
                          Account
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {platform.profileName || platform.name}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-black text-slate-400 dark:text-muted-foreground/40 uppercase tracking-widest mb-1">
                          Handle
                        </p>
                        <p className="text-sm font-bold text-neon-purple truncate">
                          {platform.handle
                            ? `@${platform.handle}`
                            : "No Handle"}
                        </p>
                      </div>
                    </div>

                    {!platform.connected && (
                      <Button
                        onClick={() => handleReconnect(platform.id)}
                        isLoading={
                          connectMutation.isPending &&
                          connectMutation.variables === platform.id
                        }
                        className="mt-4 w-full h-11 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Initialize Reconnection
                      </Button>
                    )}
                  </LensedCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <LensedCard className="py-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-border">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6 ring-1 ring-border transition-all duration-700">
            <Link2 className="w-8 h-8 text-primary opacity-40" />
          </div>

          <h3 className="text-lg font-bold uppercase italic tracking-tight mb-2">
            Ecosystem Standby
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm font-medium opacity-60">
            Your distribution network is waiting for its first node. Connect a
            platform to begin the blast.
          </p>

          <Button
            asChild
            size="lg"
            className="mt-8 h-10 px-7 rounded-lg bg-primary text-primary-foreground font-bold text-sm transition-all"
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
          confirmState.type === "disconnect"
            ? "Disconnect Connection?"
            : "Delete Connection?"
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
    <LensedCard className="p-4 h-[100px] flex items-center gap-4">
      <Skeleton className="w-16 h-16 rounded-xl bg-muted/50" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-2/3 rounded-lg bg-muted/50" />
        <Skeleton className="h-3 w-1/3 rounded-md bg-muted/50 opacity-50" />
      </div>
    </LensedCard>
  );
};
