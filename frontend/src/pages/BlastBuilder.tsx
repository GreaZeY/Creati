import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  History,
  Rocket,
  Search,
  Zap,
  Layout,
} from "lucide-react";
import { automationAPI, platformsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/lib/events";
import { motion } from "framer-motion";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { cn } from "@/lib/utils";
import { useClient } from "@/context/ClientContext";
import { PlatformChips } from "@/components/composer/Editor/PlatformChips";
import { usePlatforms } from "@/hooks/usePlatforms";

export function BlastBuilder() {
  const navigate = useNavigate();
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<any[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedClient } = useClient();

  const { connectedAccounts, platformOptions } = usePlatforms();

  const sourceAccount = connectedAccounts.find(
    (a: any) => a.accountId === sourceAccountId,
  );

  const { data: pastVideos = [], isLoading: isLoadingVideos } = useQuery({
    queryKey: ["past-videos", sourceAccount?.platform, sourceAccountId],
    queryFn: async () => {
      if (!sourceAccountId || !sourceAccount) return [];
      const resp = await platformsAPI.getVideos(
        sourceAccount.platform,
        sourceAccountId,
      );
      return resp.data.data || [];
    },
    enabled: !!sourceAccountId && !!sourceAccount,
  });

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return pastVideos;
    return pastVideos.filter(
      (v: any) =>
        v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [pastVideos, searchQuery]);

  const pushMutation = useMutation({
    mutationFn: (data: any) => automationAPI.blast(data, selectedClient?.id),
    onSuccess: () => {
      toast.success("Push initiated! 🚀 Videos syncing now.");
      navigate("/push");
    },
  });

  const toggleVideo = (video: any) => {
    setSelectedVideos((prev) =>
      prev.some((v) => v.id === video.id)
        ? prev.filter((v) => v.id !== video.id)
        : [...prev, video],
    );
  };

  const toggleTarget = (id: number) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const selectAllVideos = () => {
    if (selectedVideos.length === filteredVideos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos([...filteredVideos]);
    }
  };

  const selectAllTargets = () => {
    const targetAccounts = connectedAccounts.filter(
      (a: any) => a.accountId !== sourceAccountId,
    );
    if (selectedTargets.length === targetAccounts.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targetAccounts.map((a: any) => a.accountId));
    }
  };

  const handleLaunch = () => {
    if (!sourceAccountId) return toast.error("Choose where to raid from!");
    if (selectedVideos.length === 0)
      return toast.error("Pick some bangers first!");
    if (selectedTargets.length === 0)
      return toast.error("Where are we pushing to?");

    pushMutation.mutate({
      sourceAccountId,
      videoIds: selectedVideos.map((v) => v.id),
      targets: selectedTargets.map((id) => ({
        accountId: id,
        captionTemplate: "{title}",
      })),
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 h-[calc(100vh-100px)] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/push")}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
              QUICK PUSH{" "}
              <Rocket size={28} className="text-primary fill-primary/20" />
            </h1>
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest opacity-60">
              One-Click Video Sync
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {selectedVideos.length > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-right mr-4"
            >
              <p className="text-2xl font-black leading-none">
                {selectedVideos.length}
              </p>
              <p className="text-[10px] font-bold uppercase text-primary">
                Videos Selected
              </p>
            </motion.div>
          )}
          <Button
            size="lg"
            className="px-8 h-12 text-lg font-black gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:scale-105 active:scale-95 transition-all"
            onClick={handleLaunch}
            disabled={pushMutation.isPending}
          >
            {pushMutation.isPending ? "PUSHING..." : "PUSH NOW 🚀"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Side: Raiding the Vault */}
        <div className="flex-[1.5] flex flex-col gap-4 min-w-0">
          <Card className="p-4 bg-secondary/20 border-none shrink-0">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-3 text-muted-foreground">
              1. Pick Your Vault
            </h2>
            <div className="flex flex-wrap gap-2">
              <PlatformChips
                platforms={platformOptions}
                selectedPlatforms={
                  sourceAccountId ? [sourceAccountId.toString()] : []
                }
                onToggle={(id) => {
                  setSourceAccountId(parseInt(id));
                  setSelectedVideos([]);
                }}
                selection="single"
                maxVisibleCount={8}
              />
            </div>
          </Card>

          <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-card/40 border-border/40 min-h-0">
            <div className="p-4 border-b border-border/40 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  2. Select Bangers
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-[10px] font-medium text-muted-foreground/60">
                    Raiding {sourceAccount?.profileName || "Your Archive"}
                  </p>
                  {filteredVideos.length > 0 && (
                    <button
                      onClick={selectAllVideos}
                      className="text-[9px] font-black uppercase tracking-tighter text-primary hover:text-primary/70 transition-colors"
                    >
                      {selectedVideos.length === filteredVideos.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>
              </div>
              <div className="relative w-48">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="Search vault..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/50 border-none rounded-full py-1.5 pl-9 pr-4 text-xs focus:ring-1 ring-primary/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {!sourceAccountId ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <History size={64} className="mb-4" />
                  <p className="font-bold uppercase tracking-widest text-sm">
                    Select a source to raid
                  </p>
                </div>
              ) : isLoadingVideos ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xs font-bold uppercase animate-pulse">
                    Raiding the Vault...
                  </p>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <p className="font-black italic text-xl">
                    NO BANGERS FOUND 💀
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredVideos.map((video: any) => {
                    const isSelected = selectedVideos.some(
                      (v) => v.id === video.id,
                    );
                    return (
                      <motion.div
                        key={video.id}
                        layout
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleVideo(video)}
                        className={cn(
                          "relative group aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-primary ring-4 ring-primary/20 shadow-xl"
                            : "border-transparent",
                        )}
                      >
                        <img
                          src={video.thumbnail}
                          className={cn(
                            "w-full h-full object-cover",
                            isSelected && "opacity-50",
                          )}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                          <p className="text-[10px] font-bold text-white line-clamp-1 leading-tight">
                            {video.title}
                          </p>
                          <p className="text-[8px] text-white/60 font-medium">
                            {new Date(video.publishedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-black rounded-full flex items-center justify-center shadow-lg">
                            <Check size={12} className="stroke-[4]" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Deployment */}
        <div className="flex-1 flex flex-col gap-6 max-w-[400px]">
          <Card className="flex-1 flex flex-col p-6 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                3. Target Destinations
              </h2>
              {connectedAccounts.filter((a) => a.accountId !== sourceAccountId)
                .length > 0 && (
                <button
                  onClick={selectAllTargets}
                  className="text-[9px] font-black uppercase tracking-tighter text-primary/60 hover:text-primary transition-colors"
                >
                  {selectedTargets.length ===
                  connectedAccounts.filter(
                    (a) => a.accountId !== sourceAccountId,
                  ).length
                    ? "UNSET_ALL"
                    : "SELECT_ALL"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {connectedAccounts
                .filter((a) => a.accountId !== sourceAccountId)
                .map((acc: any) => {
                  const isSelected = selectedTargets.includes(acc.accountId);
                  return (
                    <button
                      key={acc.accountId}
                      onClick={() => toggleTarget(acc.accountId)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md translate-x-1"
                          : "border-border/40 hover:border-primary/30",
                      )}
                    >
                      <PlatformLogo platform={acc.platform} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">
                          {acc.profileName || acc.handle}
                        </p>
                        <p className="text-[10px] uppercase font-black tracking-widest opacity-40">
                          {acc.platform}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary border-primary text-black"
                            : "border-border/40",
                        )}
                      >
                        {isSelected && (
                          <Check size={14} className="stroke-[4]" />
                        )}
                      </div>
                    </button>
                  );
                })}

              <div className="text-center py-10 opacity-40">
                <Layout size={32} className="mx-auto mb-2" />
                <p className="text-xs font-bold uppercase">
                  Connect more accounts to push
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-primary/10 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase text-muted-foreground opacity-60 tracking-wider">
                  Estimated Jobs
                </p>
                <p className="text-xl font-black italic">
                  {selectedVideos.length * selectedTargets.length}
                </p>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/40">
                <div className="flex items-center gap-2 text-xs font-medium opacity-60">
                  <Zap size={12} className="text-primary fill-primary" />
                  Instant deployment. No keywords required.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
