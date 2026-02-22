import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "../lib/events";
import { CommentThread } from "../components/dashboard/CommentThread";

interface VideoContext {
  id: number;
  title: string;
  description: string;
  storage_url: string;
  status: string;
}

export const ContentApproval = () => {
  const { token } = useParams<{ token: string }>();
  const [video, setVideo] = useState<VideoContext | null>(null);
  useBranding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/agency/approval/${token}`,
        );
        const data = await res.json();
        if (data.success) {
          setVideo(data.data);
        } else {
          setError(data.error || "Approval link invalid or expired");
        }
      } catch (err) {
        setError("Failed to load content for review");
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [token]);

  const handleDecision = async (decision: "approved" | "rejected") => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/agency/approval/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        toast.success(
          decision === "approved" ? "Content Approved!" : "Feedback Sent",
        );
      } else {
        toast.error(data.error || "Failed to submit decision");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );

  if (error || submitted)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/[0.03] border border-white/10 p-12 rounded-[2.5rem] max-w-md shadow-2xl"
        >
          {submitted ? (
            <>
              <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
              <p className="text-gray-400">
                Your feedback has been sent to your account manager. You will
                receive an update once it's processed.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Link Expired</h1>
              <p className="text-gray-400">{error}</p>
            </>
          )}
        </motion.div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6 sm:p-12 overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Video Preview */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6 lg:sticky lg:top-12"
        >
          <div className="relative aspect-[9/16] max-h-[85vh] mx-auto bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group">
            {video?.storage_url ? (
              <video
                src={video.storage_url}
                controls
                className="w-full h-full object-cover"
                poster={(video as any).thumbnail_url}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-white/[0.02]">
                <Eye className="w-12 h-12 mb-4 animate-pulse" />
                <span>Processing Preview...</span>
              </div>
            )}
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-medium uppercase tracking-[0.2em]">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Reviewing Draft
            </div>
          </div>
        </motion.div>

        {/* Right: Details & Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8 py-4"
        >
          <div>
            <span className="text-primary font-bold tracking-tighter text-sm uppercase mb-2 block">
              Content Review
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              {video?.title}
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              {video?.description || "No description provided."}
            </p>
          </div>

          <div className="space-y-4">
            <CommentThread token={token} isAgency={false} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 sticky bottom-6 z-50 sm:relative sm:bottom-0">
            <button
              onClick={() => handleDecision("approved")}
              className="flex-1 flex items-center justify-center gap-3 bg-white text-black font-bold h-14 md:h-16 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-glow-white/20"
            >
              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
              Approve
            </button>
            <button
              onClick={() => handleDecision("rejected")}
              className="flex-1 flex items-center justify-center gap-3 bg-white/[0.05] border border-white/10 text-white font-bold h-14 md:h-16 rounded-2xl hover:bg-white/[0.08] transition-all"
            >
              <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
              Send Feedback
            </button>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-primary mb-2">
              What happens next?
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              If approved, the agency will be notified and the content will be
              scheduled for distribution across your connected platforms. If
              rejected, they will receive your feedback to make necessary
              revisions.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-20 pt-8 border-t border-white/5 text-center text-gray-600 text-[10px] tracking-[0.3em] uppercase">
        Creati Secure Approval Portal &copy; 2026
      </div>
    </div>
  );
};
