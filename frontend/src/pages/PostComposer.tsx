import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Zap } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { mediaAPI, postsAPI, agencyAPI } from "@/lib/api";
import { ClipboardCheck } from "lucide-react";
import { useClient } from "@/context/ClientContext";
import { SocialTextArea } from "@/components/composer/Editor/SocialTextArea";
import type { SocialTextAreaHandle } from "@/components/composer/Editor/SocialTextArea";
import { PlatformChips } from "@/components/composer/Editor/PlatformChips";
import { EditorFooter } from "@/components/composer/Editor/EditorFooter";
const AIWriteModal = lazy(() =>
  import("@/components/composer/Editor/AIWriteModal").then((m) => ({
    default: m.AIWriteModal,
  })),
);
const GiphyPicker = lazy(() =>
  import("@/components/composer/Editor/GiphyPicker").then((m) => ({
    default: m.GiphyPicker,
  })),
);
import { EmojiPicker } from "@/components/composer/Editor/EmojiPicker";
import { PreviewPane } from "@/components/composer/Preview/PreviewPane";
import { PublishDropdown } from "@/components/composer/PublishBar/PublishDropdown";
import { ScheduleModal } from "@/components/composer/PublishBar/ScheduleModal";
import { Modal } from "@/components/ui/Modal";
import { useCanva } from "@/hooks/useCanva";
import { usePlatforms } from "@/hooks/usePlatforms";
import { toast } from "@/lib/events";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { LensedCard } from "@/components/ui/LensedCard";

// Normalized post state
interface PostState {
  text: string;
  media: Array<{
    id: string;
    url: string;
    preview?: string;
    type: "image" | "video";
    file?: File;
    uploading?: boolean;
    error?: string;
  }>;
  platforms: string[];
}

const STORAGE_KEY = "draft_post";

export function PostComposer() {
  const { actor } = useParams<{ actor: string }>();
  const navigate = useNavigate();
  const { selectedClient } = useClient();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGiphyPickerOpen, setIsGiphyPickerOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);

  const editorRef = useRef<SocialTextAreaHandle>(null);

  // Canva Integration
  const canvaApiKey = import.meta.env.VITE_CANVA_API_KEY;
  const { createDesign } = useCanva(canvaApiKey);

  const handleCanvaDesign = () => {
    if (!canvaApiKey) {
      toast.error(
        "Canva API Key is missing. Please add VITE_CANVA_API_KEY to your .env file.",
      );
      return;
    }

    createDesign({
      apiKey: canvaApiKey,
      designType: "SocialMedia",
      onDesignExport: (url) => {
        const id = `canva-${Date.now()}`;
        setPost((prev) => ({
          ...prev,
          media: [
            ...prev.media,
            {
              id,
              url,
              preview: url,
              type: "image",
              uploading: false,
            },
          ],
        }));
        toast.success("Canva design attached!");
      },
    });
  };

  // Redirect if wrong actor
  useEffect(() => {
    if (actor !== "post") {
      navigate("/create/post");
    }
  }, [actor, navigate]);

  // Load draft from localStorage (without media)
  const [post, setPost] = useState<PostState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, media: [] }; // Don't restore media
      } catch {
        return { text: "", media: [], platforms: [] };
      }
    }
    return { text: "", media: [], platforms: [] };
  });

  // Auto-save draft (text + platforms only)
  useEffect(() => {
    const { media, ...draftData } = post;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
  }, [post]);

  // Fetch platforms via unified hook
  const { platforms } = usePlatforms();

  // Media upload handler
  const handleAddMedia = async (files: File[]) => {
    const newMedia = files.map((file) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      preview: URL.createObjectURL(file),
      type: (file.type.startsWith("image/") ? "image" : "video") as
        | "image"
        | "video",
      uploading: true,
    }));

    setPost((prev) => ({ ...prev, media: [...prev.media, ...newMedia] }));

    // Upload each file
    for (const item of newMedia) {
      try {
        const response = await mediaAPI.upload(item.file!);
        const uploadedMedia = response.data.data;

        setPost((prev) => ({
          ...prev,
          media: prev.media.map((m) =>
            m.id === item.id
              ? {
                  ...m,
                  id: uploadedMedia.id,
                  url: uploadedMedia.url,
                  uploading: false,
                }
              : m,
          ),
        }));
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || "Upload failed";
        toast.error(`Failed to upload ${item.file!.name}: ${errorMsg}`);

        setPost((prev) => ({
          ...prev,
          media: prev.media.map((m) =>
            m.id === item.id ? { ...m, uploading: false, error: errorMsg } : m,
          ),
        }));
      }
    }
  };

  const handleRemoveMedia = (id: string) => {
    setPost((prev) => ({
      ...prev,
      media: prev.media.filter((m) => m.id !== id),
    }));
  };

  const handleSelectGif = async (gifUrl: string) => {
    // Add GIF as media (temp, upload later if needed)
    const gifMedia = {
      id: `gif-${Date.now()}`,
      url: gifUrl,
      preview: gifUrl,
      type: "image" as const,
    };
    setPost((prev) => ({ ...prev, media: [...prev.media, gifMedia] }));
  };

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (scheduledAt?: Date) => {
      const validMedia = post.media.filter((m) => !m.error && !m.uploading);

      return postsAPI.create(
        {
          text: post.text,
          platformIds: post.platforms,
          mediaIds: validMedia.map((m) => m.id),
          scheduledAt,
        },
        selectedClient?.id,
      );
    },
    onSuccess: (_, scheduledAt) => {
      const message = scheduledAt
        ? `Scheduled for ${scheduledAt.toLocaleString()}! 📅`
        : "Post published! 🚀";

      toast.success(message);
      localStorage.removeItem(STORAGE_KEY);
      setPost({ text: "", media: [], platforms: [] });

      // Navigate to queued jobs
      navigate("/queued");
    },
    onError: (error: any) => {
      const errorMsg =
        error.response?.data?.message || "Failed to publish post";
      toast.error(errorMsg);
    },
  });

  const handlePublishNow = () => {
    if (post.platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    const hasUploadingMedia = post.media.some((m) => m.uploading);
    if (hasUploadingMedia) {
      toast.error("Wait for media to finish uploading");
      return;
    }

    publishMutation.mutate(undefined);
  };

  const handleSchedule = (scheduledDate: Date) => {
    publishMutation.mutate(scheduledDate);
  };

  const handleRequestApproval = async () => {
    if (post.platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    try {
      // 1. Create the post in 'Draft' status
      const res = await postsAPI.create(
        {
          text: post.text,
          platformIds: post.platforms,
          mediaIds: post.media.map((m) => m.id),
        },
        selectedClient?.id,
      );

      if (res.data.success) {
        const videoId = parseInt(res.data.data.id);
        // 2. Generate approval link
        const approvalRes = await agencyAPI.createApprovalLink(videoId);
        if (approvalRes.data.success) {
          const url = `${window.location.origin}/approve/${approvalRes.data.data.token}`;
          navigator.clipboard.writeText(url);
          toast.success(
            "Approval link copied to clipboard! Send it to your client.",
          );

          localStorage.removeItem(STORAGE_KEY);
          setPost({ text: "", media: [], platforms: [] });
          navigate("/queued");
        }
      }
    } catch (err) {
      toast.error("Failed to generate approval request");
    }
  };

  const hasDraft = post.text.length > 0 || post.media.length > 0;
  const isPublishing = publishMutation.isPending;

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleAddMedia(files);
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col space-y-8 max-w-[1600px] mx-auto px-8 w-full relative z-0">
      {/* Structural Depth - Atmospheric Blobs (v14 Parity) */}
      {/* <div className="absolute top-[-5%] right-[-10%] w-[500px] h-[500px] bg-[var(--blob-1)] rounded-full blur-[100px] pointer-events-none mix-blend-screen dark:mix-blend-screen mix-blend-multiply z-0" />
      <div className="absolute bottom-[-5%] left-[-10%] w-[500px] h-[500px] bg-[var(--blob-2)] rounded-full blur-[100px] pointer-events-none mix-blend-screen dark:mix-blend-screen mix-blend-multiply z-0" /> */}

      <PageHeader
        title="Post Composer"
        description="Craft your message for the entire ecosystem. Precision and impact."
      >
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRequestApproval}
            disabled={!hasDraft || post.platforms.length === 0 || isPublishing}
            variant="outline"
            className="gap-2 border-primary/20 hover:border-primary/40 bg-primary/5 rounded-xl h-11"
          >
            <ClipboardCheck size={18} />
            Send for Approval
          </Button>
          <PublishDropdown
            onPublishNow={handlePublishNow}
            onSchedule={() => setIsScheduleModalOpen(true)}
            disabled={!hasDraft || post.platforms.length === 0 || isPublishing}
          />
        </div>
      </PageHeader>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 relative z-10">
        <div className="lg:col-span-7 flex flex-col min-h-0 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex-1 flex flex-col transition-all duration-300 rounded-[2rem]",
              isDragging && "ring-2 ring-primary shadow-glow-purple",
            )}
          >
            <LensedCard
              className={cn(
                "flex-1 flex flex-col p-8 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass rounded-[2rem]",
              )}
            >
              <div className="flex-1 flex flex-col pr-2 custom-scrollbar space-y-8">
                {/* Platforms in Editor Area for better UX */}
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 block">
                    Active Uplink Nodes
                  </label>
                  <PlatformChips
                    platforms={platforms}
                    selectedPlatforms={post.platforms}
                    onToggle={(platformId) =>
                      setPost((prev) => ({
                        ...prev,
                        platforms: prev.platforms.includes(platformId)
                          ? prev.platforms.filter((p) => p !== platformId)
                          : [...prev.platforms, platformId],
                      }))
                    }
                  />
                </div>

                <div className="space-y-4 flex-1 flex flex-col min-h-[300px]">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 block">
                    Transmission Payload
                  </label>
                  <div className="flex-1 bg-slate-50 dark:bg-black/20 rounded-[2rem] p-8 border border-slate-100 dark:border-white/5 focus-within:ring-2 ring-primary/20 transition-all">
                    <SocialTextArea
                      ref={editorRef}
                      value={post.text}
                      onChange={(text) =>
                        setPost((prev) => ({ ...prev, text }))
                      }
                      placeholder="Ecosystem broadcast sequence ready. Awaiting input..."
                    />
                  </div>
                </div>

                {/* Media Preview Grid */}
                {post.media.length > 0 && (
                  <div className="grid grid-cols-4 gap-4">
                    {post.media.slice(0, 4).map((m) => (
                      <div
                        key={m.id}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 group"
                      >
                        <img
                          src={m.preview || m.url}
                          className="w-full h-full object-cover"
                        />
                        {m.uploading && (
                          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                          </div>
                        )}
                        <button
                          onClick={() => handleRemoveMedia(m.id)}
                          className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Zap size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                <EditorFooter
                  onMediaClick={() =>
                    document.getElementById("media-upload-input")?.click()
                  }
                  onEmojiClick={(el) => {
                    setEmojiAnchor(el);
                    setIsEmojiPickerOpen(true);
                  }}
                  onAIClick={() => setIsAIModalOpen(true)}
                  onCanvaClick={handleCanvaDesign}
                  onGiphyClick={() => setIsGiphyPickerOpen(true)}
                />
              </div>
            </LensedCard>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col min-h-0 space-y-6">
          <LensedCard className="flex-1 min-h-0 bg-white dark:bg-black/20 border-0 shadow-2xl dark:shadow-none ring-1 ring-slate-100 dark:ring-white/5 rounded-[3rem] relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-neon-purple via-neon-blue to-neon-pink" />
            <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 block">
                Visual Projection
              </label>
            </div>
            <div className="flex-1 p-8 custom-scrollbar">
              <PreviewPane
                selectedPlatformIds={post.platforms}
                platforms={platforms}
                postText={post.text}
                media={post.media}
              />
            </div>
          </LensedCard>

          <LensedCard className="p-8 bg-neon-purple/5 border-0 ring-1 ring-neon-purple/20 rounded-[2rem]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-purple mb-2">
              System Insight
            </p>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
              Distribution sequence optimized for current ecosystem traffic.{" "}
              <br />
              <span className="text-slate-900 dark:text-white">
                Reach potential: High Affinity.
              </span>
            </p>
          </LensedCard>
        </div>
      </div>

      <input
        type="file"
        id="media-upload-input"
        className="hidden"
        multiple
        accept="image/*,video/*"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) handleAddMedia(files);
        }}
      />

      <Suspense fallback={null}>
        <AIWriteModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          onInsert={(text) =>
            setPost((prev) => ({ ...prev, text: prev.text + text }))
          }
          currentText={post.text}
        />
      </Suspense>

      <Modal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        title={`Transmission Assets (${post.media.length})`}
      >
        <div className="p-8 max-w-4xl w-full">
          <div className="grid grid-cols-3 gap-6 max-h-[60vh] pr-4 custom-scrollbar">
            {post.media.map((m) => (
              <div
                key={m.id}
                className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10"
              >
                <img
                  src={m.preview || m.url}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveMedia(m.id)}
                  className="absolute top-4 right-4 h-10 w-10 bg-slate-900/90 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Zap size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Suspense fallback={null}>
        <GiphyPicker
          isOpen={isGiphyPickerOpen}
          onClose={() => setIsGiphyPickerOpen(false)}
          onSelect={handleSelectGif}
        />
      </Suspense>

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSchedule={handleSchedule}
      />

      <EmojiPicker
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        anchorEl={emojiAnchor}
        onEmojiSelect={(emoji) => {
          setPost((prev) => ({ ...prev, text: prev.text + emoji }));
          setIsEmojiPickerOpen(false);
        }}
      />
    </div>
  );
}
