import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { platformsAPI, mediaAPI, postsAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { SocialTextArea } from "@/components/composer/Editor/SocialTextArea";
import { PlatformChips } from "@/components/composer/Editor/PlatformChips";
import { EditorFooter } from "@/components/composer/Editor/EditorFooter";
import { AIWriteModal } from "@/components/composer/Editor/AIWriteModal";
import { GiphyPicker } from "@/components/composer/Editor/GiphyPicker";
import { PreviewPane } from "@/components/composer/Preview/PreviewPane";
import { PublishDropdown } from "@/components/composer/PublishBar/PublishDropdown";
import { ScheduleModal } from "@/components/composer/PublishBar/ScheduleModal";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/events";
import { PageHeader } from "@/components/ui/PageHeader";

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

  // Fetch connected platforms
  const { data: platformsData } = useQuery({
    queryKey: ["platforms", selectedClient?.id],
    queryFn: async () => {
      const response = await platformsAPI.list(selectedClient?.id);
      return response.data.data;
    },
  });

  const platforms =
    platformsData?.map((p: any) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      accountId: p.accountId,
      handle: p.handle,
    })) ?? [];

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
    onSuccess: (response, scheduledAt) => {
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

  const hasDraft = post.text.length > 0 || post.media.length > 0;
  const isPublishing = publishMutation.isPending;

  return (
    <div className="flex h-screen flex-col">
      <PageHeader description="Create Post">
        <PublishDropdown
          onPublishNow={handlePublishNow}
          onSchedule={() => setIsScheduleModalOpen(true)}
          disabled={!hasDraft || post.platforms.length === 0 || isPublishing}
        />
      </PageHeader>
      <div className="flex mt-2 h-full border border-border/40">
        {/* Left Pane: Editor (60%) */}
        <div className="w-[60%] flex flex-col border-r border-border/40">
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Platforms */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Platforms
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

            {/* Text Editor with Drop Zone */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Message
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-2", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    handleAddMedia(files);
                  }
                }}
                className="border border-border/40 rounded-lg p-3 bg-card/20 transition-all"
              >
                <SocialTextArea
                  value={post.text}
                  onChange={(text) => setPost((prev) => ({ ...prev, text }))}
                  placeholder="What's on your mind? (Drag images/videos here)"
                />

                {/* Media Previews (Max 4) */}
                {post.media.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 h-48">
                    {post.media.slice(0, 4).map((m, index) => (
                      <div
                        key={m.id}
                        className="relative group rounded-lg overflow-hidden border border-border/40 bg-accent/5"
                      >
                        <img
                          src={m.preview || m.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {m.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                          </div>
                        )}
                        {m.error && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <p className="text-xs text-red-500">Error</p>
                          </div>
                        )}
                        {/* +N More Overlay */}
                        {index === 3 && post.media.length > 4 && (
                          <button
                            onClick={() => setIsMediaModalOpen(true)}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                          >
                            <span className="text-2xl font-bold">
                              +{post.media.length - 4}
                            </span>
                          </button>
                        )}
                        {/* Remove Button */}
                        {!m.uploading &&
                          index < 4 &&
                          !(index === 3 && post.media.length > 4) && (
                            <button
                              onClick={() => handleRemoveMedia(m.id)}
                              className="absolute top-2 right-2 h-6 w-6 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleAddMedia(files);
              }
              e.target.value = ""; // Reset for re-selection
            }}
            className="hidden"
            id="media-upload-input"
          />

          {/* Footer */}
          <EditorFooter
            onMediaClick={() =>
              document.getElementById("media-upload-input")?.click()
            }
            onEmojiClick={() => toast.info("Emoji picker coming soon")}
            onAIClick={() => setIsAIModalOpen(true)}
            onCanvaClick={() => toast.info("Canva integration coming soon")}
            onGiphyClick={() => setIsGiphyPickerOpen(true)}
          />
        </div>

        {/* Right Pane: Preview (40%) */}
        <PreviewPane
          selectedPlatformIds={post.platforms}
          platforms={platforms}
          postText={post.text}
          media={post.media}
        />

        {/* AI Write Modal */}
        <AIWriteModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          onInsert={(text) => setPost((prev) => ({ ...prev, text }))}
          currentText={post.text}
        />

        {/* Media View Modal */}
        <Modal
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          title={`Media (${post.media.length})`}
        >
          <div className="p-6 max-w-4xl w-full">
            <div className="grid grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto">
              {post.media.map((m) => (
                <div key={m.id} className="relative group aspect-square">
                  <img
                    src={m.preview || m.url}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-border/40"
                  />
                  {m.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                    </div>
                  )}
                  {m.error && (
                    <div className="absolute inset-0 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <p className="text-xs text-red-500">Error</p>
                    </div>
                  )}
                  {!m.uploading && (
                    <button
                      onClick={() => handleRemoveMedia(m.id)}
                      className="absolute top-2 right-2 h-6 w-6 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* Giphy Picker */}
        <GiphyPicker
          isOpen={isGiphyPickerOpen}
          onClose={() => setIsGiphyPickerOpen(false)}
          onSelect={handleSelectGif}
        />

        {/* Schedule Modal */}
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSchedule={handleSchedule}
        />
      </div>
    </div>
  );
}
