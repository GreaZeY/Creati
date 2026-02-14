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
import { EmptyState } from "@/components/ui/EmptyState";

interface PlatformData {
  accountId?: number;
  id: string; // unique ID (accountID or platform name)
  name: string;
  platform: string;
  connected: boolean;
  profileName?: string;
  platformUserId?: string;
  handle?: string;
  profilePicture?: string;
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
    <div className="flex-1 overflow-y-auto space-y-8 pb-12 max-w-7xl mx-auto px-4 font-outfit w-full">
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
                    className={cn(
                      "p-5 relative flex flex-row items-center gap-6",
                      !platform.connected && "opacity-60",
                    )}
                  >
                    {/* Dropdown Menu - Absolute Top Right */}
                    <div className="absolute top-2 right-2 z-20">
                      <DropdownMenu
                        trigger={
                          <button className="p-2.5 rounded-full text-muted-foreground/80 hover:text-foreground hover:bg-secondary/80 transition-all">
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
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </div>

                    {/* Watermark Logo Background */}
                    <div className="absolute right-[50px] top-1/2 -translate-y-1/2 h-full aspect-square opacity-30 pointer-events-none select-none">
                      <div
                        className={cn(
                          "w-full h-full flex items-center justify-center relative -right-10",
                          accentClass.split(" ")[0],
                        )}
                        style={{
                          maskImage:
                            "radial-gradient(circle, white 18%, transparent 60%)",
                          WebkitMaskImage:
                            "radial-gradient(circle, white 18%, transparent 60%)",
                        }}
                      >
                        <PlatformLogo
                          platform={platform.platform}
                          size={140}
                          className="text-current"
                        />
                      </div>
                    </div>

                    <div className="flex flex-1 flex-row min-w-0 gap-2 items-center relative z-10">
                      {platform.profilePicture && (
                        <img
                          src={platform.profilePicture}
                          alt="Profile Picture"
                          width={50}
                          // height={120}
                          className="aspect-square rounded-full"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold tracking-tight uppercase truncate leading-none">
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
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-40 mt-1">
                          {platform.platform}{" "}
                          {platform.handle ? `// ${platform.handle}` : ""}
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
                        className="h-10 px-6 rounded-xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all"
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
        <EmptyState
          icon={Link2}
          title="No Platforms Connected"
          description="Connect a platform to begin the blast."
        />
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
    <LensedCard className="p-8 h-[140px] flex items-center gap-8">
      <Skeleton className="w-20 h-20 rounded-2xl bg-muted/50" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-2/3 rounded-xl bg-muted/50" />
        <Skeleton className="h-4 w-1/3 rounded-lg bg-muted/50 opacity-50" />
      </div>
    </LensedCard>
  );
};
