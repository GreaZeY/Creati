import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { SocialTextArea } from "@/components/composer/Editor/SocialTextArea";
import { PlatformChips } from "@/components/composer/Editor/PlatformChips";
import { EditorFooter } from "@/components/composer/Editor/EditorFooter";
import { PreviewPane } from "@/components/composer/Preview/PreviewPane";
import { PublishDropdown } from "@/components/composer/PublishBar/PublishDropdown";
import { ScheduleModal } from "@/components/composer/PublishBar/ScheduleModal";
import { toast } from "@/lib/events";
import { PageHeader } from "@/components/ui/PageHeader";

// Normalized post state
interface PostState {
  text: string;
  media: Array<{ id: string; url: string; type: "image" | "video" }>;
  platforms: string[];
}

const STORAGE_KEY = "draft_post";

export function PostComposer() {
  const { actor } = useParams<{ actor: string }>();
  const navigate = useNavigate();
  const { selectedClient } = useClient();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Redirect if wrong actor
  useEffect(() => {
    if (actor !== "post") {
      navigate("/create/post");
    }
  }, [actor, navigate]);

  // Load draft from localStorage
  const [post, setPost] = useState<PostState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { text: "", media: [], platforms: [] };
      }
    }
    return { text: "", media: [], platforms: [] };
  });

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(post));
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

  const handlePublishNow = () => {
    if (post.platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    console.log("Publishing now:", post);
    toast.success("Post published! 🚀");
    localStorage.removeItem(STORAGE_KEY);
    setPost({ text: "", media: [], platforms: [] });
  };

  const handleSchedule = (scheduledDate: Date) => {
    console.log("Scheduling for:", scheduledDate, post);
    toast.success(`Scheduled for ${scheduledDate.toLocaleString()}! 📅`);
    localStorage.removeItem(STORAGE_KEY);
    setPost({ text: "", media: [], platforms: [] });
  };

  const hasDraft = post.text.length > 0 || post.media.length > 0;

  return (
    <div className="flex h-screen flex-col">
      <PageHeader description="Create Post">
        <PublishDropdown
          onPublishNow={handlePublishNow}
          onSchedule={() => setIsScheduleModalOpen(true)}
          disabled={!hasDraft || post.platforms.length === 0}
        />
      </PageHeader>
      <div className="flex mt-2 h-full">
        {/* Left Pane: Editor (40%) */}
        <div className="w-[40%] flex flex-col border-r border-border/40">
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

            {/* Text Editor */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Message
              </label>
              <div className="border border-border/40 rounded-lg p-3 bg-card/20">
                <SocialTextArea
                  value={post.text}
                  onChange={(text) => setPost((prev) => ({ ...prev, text }))}
                  placeholder="What's on your mind?"
                />
              </div>
            </div>

            {/* Media Previews */}
            {post.media.length > 0 && (
              <div className="space-y-2">
                {post.media.map((m) => (
                  <div key={m.id} className="relative group">
                    <img
                      src={m.url}
                      alt=""
                      className="w-full rounded-lg border border-border/40"
                    />
                    <button
                      onClick={() =>
                        setPost((prev) => ({
                          ...prev,
                          media: prev.media.filter(
                            (media) => media.id !== m.id,
                          ),
                        }))
                      }
                      className="absolute top-2 right-2 h-6 w-6 bg-black/80 hover:bg-black text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <EditorFooter
            onImageClick={() => toast.info("Image upload coming soon")}
            onVideoClick={() => toast.info("Video upload coming soon")}
            onAIClick={() => toast.info("AI writing coming soon")}
            onCanvaClick={() => toast.info("Canva integration coming soon")}
            onGiphyClick={() => toast.info("Giphy search coming soon")}
          />
        </div>

        {/* Right Pane: Preview (60%) */}
        <PreviewPane
          selectedPlatforms={post.platforms}
          postText={post.text}
          media={post.media}
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
