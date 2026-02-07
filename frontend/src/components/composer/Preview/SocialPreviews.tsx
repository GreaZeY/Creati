import { cn } from "@/lib/utils";

interface PlatformPreviewProps {
  name: string;
  handle: string;
  text: string;
  media: Array<{ url: string; type: "image" | "video" }>;
  platform: string;
}

export function InstagramPreview({
  name,
  handle,
  text,
  media,
}: PlatformPreviewProps) {
  return (
    <div className="bg-card rounded-xl border border-border/40 max-w-[470px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{handle}</p>
        </div>
        <button className="text-muted-foreground/60">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Media (Square) */}
      {media.length > 0 ? (
        <div className="aspect-square bg-accent/10 border-y border-border/40">
          {media[0].type === "image" ? (
            <img
              src={media[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/5">
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
      ) : (
        <div className="aspect-square bg-accent/10 border-y border-border/40 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/40">No media</p>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <button className="hover:text-red-500 transition-colors">
              <svg
                className="w-6 h-6"
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
            <button>
              <svg
                className="w-6 h-6"
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
            <button>
              <svg
                className="w-6 h-6"
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
            </button>
          </div>
          <button>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>

        {/* Caption */}
        <div className="text-sm">
          <span className="font-semibold mr-1">{handle}</span>
          <span className="break-words">
            {text || "Your caption will appear here..."}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DiscordPreview({
  name,
  handle,
  text,
  media,
}: PlatformPreviewProps) {
  return (
    <div className="bg-[#36393f] rounded-lg p-4 max-w-[590px] text-[#dcddde]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">{name}</span>
            <span className="text-xs text-[#72767d]">now</span>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-2">
            {text || "Your message will appear here..."}
          </p>

          {/* Media */}
          {media.length > 0 && (
            <div className="rounded-lg overflow-hidden max-w-md">
              {media[0].type === "image" ? (
                <img src={media[0].url} alt="" className="w-full rounded" />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-black/30 rounded">
                  <svg
                    className="w-16 h-16 text-[#72767d]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RedditPreview({
  name,
  handle,
  text,
  media,
}: PlatformPreviewProps) {
  return (
    <div className="bg-card rounded border border-border/40 max-w-[590px]">
      {/* Vote Column */}
      <div className="flex">
        <div className="flex flex-col items-center gap-1 p-2 bg-accent/10 border-r border-border/40">
          <button className="text-muted-foreground/60 hover:text-orange-500">
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
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
          <span className="text-xs font-bold">0</span>
          <button className="text-muted-foreground/60 hover:text-blue-500">
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-3">
          {/* Header */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className="font-medium">r/community</span>
            <span>·</span>
            <span>Posted by u/{handle}</span>
            <span>·</span>
            <span>now</span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-base mb-2">
            {text ? text.split("\n")[0] : "Your post title will appear here..."}
          </h3>

          {/* Body */}
          {text && text.includes("\n") && (
            <p className="text-sm text-muted-foreground mb-2">
              {text.split("\n").slice(1).join("\n")}
            </p>
          )}

          {/* Media */}
          {media.length > 0 && (
            <div className="rounded overflow-hidden mb-2">
              {media[0].type === "image" ? (
                <img src={media[0].url} alt="" className="w-full" />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-black/5">
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
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <button className="flex items-center gap-1 hover:bg-accent/50 px-2 py-1 rounded">
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
              0 Comments
            </button>
            <button className="flex items-center gap-1 hover:bg-accent/50 px-2 py-1 rounded">
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
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
