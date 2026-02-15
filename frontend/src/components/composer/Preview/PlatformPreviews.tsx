import { cn } from "@/lib/utils";

interface PlatformPreviewProps {
  name: string;
  handle: string;
  text: string;
  media: Array<{ url: string; type: "image" | "video" }>;
  platform: string;
}

export function TwitterPreview({
  name,
  handle,
  text,
  media,
}: PlatformPreviewProps) {
  return (
    <div className="bg-card rounded-xl border border-border/40 p-4 max-w-[590px]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-bold text-sm truncate">{name}</p>
            <svg
              className="w-4 h-4 text-blue-500 flex-shrink-0"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"
              />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">@{handle}</p>
        </div>
        <span className="text-xs text-muted-foreground">now</span>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {text || "Your post will appear here..."}
        </p>
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div
          className={cn(
            "rounded-2xl overflow-hidden border border-border/40 mb-3",
            media.length === 1
              ? "grid grid-cols-1"
              : "grid grid-cols-2 gap-0.5",
          )}
        >
          {media.slice(0, 4).map((m, i) => (
            <div
              key={i}
              className={cn(
                "relative aspect-video bg-accent/10",
                media.length === 3 && i === 0 && "col-span-2",
              )}
            >
              {m.type === "image" ? (
                <img
                  src={m.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/5">
                  <svg
                    className="w-12 h-12 text-muted-foreground/40"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40 text-muted-foreground/60">
        <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
        <button className="flex items-center gap-2 hover:text-green-500 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <button className="flex items-center gap-2 hover:text-red-500 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function LinkedInPreview({
  name,
  handle,
  text,
  media,
}: PlatformPreviewProps) {
  return (
    <div className="bg-card rounded-xl border border-border/40 p-4 max-w-[590px]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-700/20 to-blue-800/20 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            @{handle} • now
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {text || "Your post will appear here..."}
        </p>
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-border/40 mb-3">
          {media[0].type === "image" ? (
            <img src={media[0].url} alt="" className="w-full object-cover" />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-black/5">
              <svg
                className="w-16 h-16 text-muted-foreground/40"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Engagement Bar */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/40 text-xs text-muted-foreground/60">
        <button className="flex items-center gap-1 hover:text-blue-700 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
          <span>Like</span>
        </button>
        <button className="flex items-center gap-1 hover:text-blue-700 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-1 hover:text-blue-700 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Repost</span>
        </button>
        <button className="flex items-center gap-1 hover:text-blue-700 transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}

export function FacebookPreview({ name, text, media }: PlatformPreviewProps) {
  return (
    <div className="bg-card rounded-xl border border-border/40 p-4 max-w-[590px]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/20 to-blue-700/20 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            now · 🌎
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {text || "Your post will appear here..."}
        </p>
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-3 -mx-4">
          {media[0].type === "image" ? (
            <img src={media[0].url} alt="" className="w-full object-cover" />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-black/5">
              <svg
                className="w-16 h-16 text-muted-foreground/40"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Engagement Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/60 mb-2 px-4">
        <span>👍 ❤️ 😮</span>
        <div className="flex gap-2">
          <span>0 Comments</span>
          <span>0 Shares</span>
        </div>
      </div>

      {/* Engagement Bar */}
      <div className="flex items-center justify-around pt-2 border-t border-border/40">
        <button className="flex items-center gap-2 py-2 text-sm text-muted-foreground/60 hover:bg-accent/50 flex-1 justify-center rounded transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
          Like
        </button>
        <button className="flex items-center gap-2 py-2 text-sm text-muted-foreground/60 hover:bg-accent/50 flex-1 justify-center rounded transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Comment
        </button>
        <button className="flex items-center gap-2 py-2 text-sm text-muted-foreground/60 hover:bg-accent/50 flex-1 justify-center rounded transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </button>
      </div>
    </div>
  );
}
