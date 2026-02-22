import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agencyAPI, publicAPI } from "@/lib/api";
import { MessageSquare, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  userId?: number;
  clientId?: number;
}

interface CommentThreadProps {
  videoId?: number;
  token?: string;
  isAgency?: boolean;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  videoId,
  token,
  isAgency = false,
}) => {
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const queryClient = useQueryClient();

  const queryKey = isAgency
    ? ["comments", videoId]
    : ["public-comments", token];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const resp = isAgency
        ? await agencyAPI.getComments(videoId!)
        : await publicAPI.getComments(token!);
      return resp.data.data;
    },
    enabled: !!(isAgency ? videoId : token),
    refetchInterval: 10000, // Poll every 10s for new comments
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (isAgency) {
        return agencyAPI.addComment(videoId!, newComment, isInternal);
      } else {
        return publicAPI.addComment(token!, newComment);
      }
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    mutation.mutate();
  };

  return (
    <div className="flex flex-col h-full bg-charcoal/20 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon-lime" />
          <h4 className="text-xs font-black uppercase tracking-widest text-white">
            Activity Log
          </h4>
        </div>
        {isAgency && (
          <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg">
            <input
              type="checkbox"
              id="internal"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="w-3 h-3 accent-neon-lime"
            />
            <label
              htmlFor="internal"
              className="text-[10px] font-bold text-white/60 flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3" />
              Internal Note
            </label>
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-neon-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <MessageSquare className="w-12 h-12 mb-2" />
            <p className="text-xs font-bold">No activity yet</p>
          </div>
        ) : (
          <AnimatePresence>
            {comments.map((comment: Comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 ${comment.isInternal ? "bg-neon-purple/5 border border-neon-purple/20 p-3 rounded-2xl" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    comment.isInternal
                      ? "bg-neon-purple text-dark border border-white/20"
                      : comment.userId
                        ? "bg-neon-lime text-dark border border-white/20"
                        : "bg-white/10 text-white border border-white/10"
                  }`}
                >
                  {comment.isInternal ? "A" : comment.userId ? "A" : "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      {comment.isInternal
                        ? "Internal Note"
                        : comment.userId
                          ? "Agency Team"
                          : "Client Feedback"}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white/90 break-words leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-white/5 bg-white/5"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={
              isInternal ? "Type internal note..." : "Add feedback..."
            }
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={mutation.isPending}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-neon-lime/50 transition-colors"
          />
          <Button
            type="submit"
            size="icon"
            disabled={mutation.isPending || !newComment.trim()}
            className="rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
