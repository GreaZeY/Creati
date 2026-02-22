import { useQuery } from "@tanstack/react-query";
import { agencyAPI } from "@/lib/api";
import { LensedCard } from "@/components/ui/LensedCard";
import { Button } from "@/components/ui/Button";
import {
  ClipboardCheck,
  ExternalLink,
  Clock,
  Copy,
  MessageSquare,
} from "lucide-react";
import { toast } from "@/lib/events";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { CommentThread } from "./CommentThread";
import { useState } from "react";

export function ApprovalHub() {
  const { data: approvals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const resp = await agencyAPI.listApprovals();
      return resp.data.data;
    },
    // Poll every 30 seconds for new agency-wide approvals
    refetchInterval: 30000,
  });

  const [selectedVideo, setSelectedVideo] = useState<{
    id: number;
    title: string;
  } | null>(null);

  if (approvals.length === 0) return null;

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/approve/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Approval link copied to clipboard!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-neon-purple/20 flex items-center justify-center text-neon-purple border border-neon-purple/30 shadow-glow-purple">
            <ClipboardCheck size={16} />
          </div>
          <h3 className="text-lg font-black font-display tracking-tight text-foreground dark:text-white uppercase italic">
            Approval Hub
          </h3>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-neon-purple/10 text-neon-purple text-[10px] font-bold border border-neon-purple/20">
            {approvals.length} ACTION REQUIRED
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {approvals.map((approval: any) => (
            <motion.div
              key={approval.id}
              layout
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <LensedCard className="p-5 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass rounded-2xl group hover:ring-neon-purple/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div
                      className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block"
                      style={{
                        backgroundColor: `${approval.clientColor}20`,
                        color: approval.clientColor,
                      }}
                    >
                      {approval.clientName}
                    </div>
                    <h4 className="font-bold text-sm line-clamp-1 text-slate-900 dark:text-white">
                      {approval.title || "Untitled Post"}
                    </h4>
                  </div>
                  <div className="text-slate-400 dark:text-muted-foreground/40">
                    <Clock size={14} />
                  </div>
                </div>

                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-black/40 mb-4 relative group-hover:shadow-glow-purple/20 transition-all">
                  <img
                    src={approval.storageURL}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    alt={approval.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <p className="text-[10px] text-white/60 font-medium">
                      Created{" "}
                      {new Date(approval.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 rounded-xl h-9 text-xs border-primary/20 hover:border-primary/40 bg-primary/5"
                    onClick={() => handleCopyLink(approval.token)}
                    disabled={!approval.token}
                  >
                    <Copy size={14} />
                    Copy Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-neon-lime/10 text-neon-lime"
                    onClick={() =>
                      setSelectedVideo({
                        id: approval.id,
                        title: approval.title,
                      })
                    }
                  >
                    <MessageSquare size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-neon-purple/10 text-neon-purple"
                    onClick={() =>
                      window.open(`/approve/${approval.token}`, "_blank")
                    }
                    disabled={!approval.token}
                  >
                    <ExternalLink size={14} />
                  </Button>
                </div>
              </LensedCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Modal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        title={`Discussion: ${selectedVideo?.title}`}
      >
        <div className="p-1">
          <CommentThread videoId={selectedVideo?.id} isAgency={true} />
        </div>
      </Modal>
    </motion.div>
  );
}
