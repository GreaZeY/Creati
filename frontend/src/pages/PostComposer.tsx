import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { ComposerAccordion } from "@/components/composer/ComposerAccordion";
import { PostTextEditor } from "@/components/composer/PostTextEditor";
import { PlatformSelector } from "@/components/composer/PlatformSelector";
import { Button } from "@/components/ui/Button";
import { Type, Image, Sparkles, Send } from "lucide-react";
import { useClient } from "@/context/ClientContext";

// Normalized post state
interface PostState {
  text: string;
  media: Array<{ id: string; url: string; type: "image" | "video" }>;
  platforms: string[];
  canvaDesign?: { id: string; url: string };
}

const STORAGE_KEY = "draft_post";

export function PostComposer() {
  const { actor } = useParams<{ actor: string }>();
  const navigate = useNavigate();
  const { selectedClient } = useClient();

  // If actor is not "post", redirect or show error
  useEffect(() => {
    if (actor !== "post") {
      navigate("/create/post");
    }
  }, [actor, navigate]);

  // Load draft from localStorage on mount
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

  // Save to localStorage whenever post changes
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

  // Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["text"]),
  );

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handlePublish = () => {
    // TODO: Implement publish logic
    console.log("Publishing:", post);
    // Clear draft after successful publish
    localStorage.removeItem(STORAGE_KEY);
    setPost({ text: "", media: [], platforms: [] });
  };

  const hasDraft = post.text.length > 0 || post.media.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 font-outfit flex flex-col overflow-y-auto flex-1 min-h-0 w-full">
      <PageHeader
        title="Create Post"
        description="One draft, infinite reach. Craft your message and publish everywhere."
      />

      <div className="space-y-4">
        {/* Text Editor */}
        <ComposerAccordion
          title="Write Your Post"
          icon={Type}
          isOpen={openSections.has("text")}
          onToggle={() => toggleSection("text")}
        >
          <PostTextEditor
            value={post.text}
            onChange={(text) => setPost((prev) => ({ ...prev, text }))}
            placeholder="What's your message? Share your story..."
          />
        </ComposerAccordion>

        {/* Platform Selection */}
        <ComposerAccordion
          title="Target Platforms"
          icon={Send}
          isOpen={openSections.has("platforms")}
          onToggle={() => toggleSection("platforms")}
        >
          <PlatformSelector
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
        </ComposerAccordion>

        {/* Media (Placeholder) */}
        <ComposerAccordion
          title="Media & Design"
          icon={Image}
          isOpen={openSections.has("media")}
          onToggle={() => toggleSection("media")}
        >
          <div className="text-sm text-muted-foreground text-center py-8">
            <p className="font-bold uppercase tracking-wider">
              Canva integration coming soon
            </p>
          </div>
        </ComposerAccordion>

        {/* AI Assistant (Placeholder) */}
        <ComposerAccordion
          title="AI Assistant"
          icon={Sparkles}
          isOpen={openSections.has("ai")}
          onToggle={() => toggleSection("ai")}
        >
          <div className="text-sm text-muted-foreground text-center py-8">
            <p className="font-bold uppercase tracking-wider">
              AI generation coming next
            </p>
          </div>
        </ComposerAccordion>
      </div>

      {/* Publish Button */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border/40 -mx-4 -mb-4 md:-mx-8 md:-mb-8 p-4 md:p-6">
        <Button
          onClick={handlePublish}
          disabled={!hasDraft || post.platforms.length === 0}
          size="lg"
          className="w-full"
        >
          <Send size={18} />
          Publish to {post.platforms.length} Platform
          {post.platforms.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
