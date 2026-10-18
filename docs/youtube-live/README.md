# YouTube Live producer

The primary flow is: describe the stream → research and prepare → review the title,
thumbnail, description, and tags → approve → open the scheduled event in OBS.
Automatic start is disabled. Creati does not control OBS or start the broadcast.

## Server setup

Apply `backend/internal/db/migrations/15_youtube_live.sql` and
`backend/internal/db/migrations/16_youtube_live_preferences.sql` to an existing database
in a transaction. Fresh initialization includes these tables in
`00_init_schema.sql`. Use PostgreSQL's `ON_ERROR_STOP` when applying SQL; avoid
rerunning unrelated historical migrations on an existing installation.

Set these in `backend/.env` or the backend process environment, then restart:

```dotenv
# Anthropic-compatible Messages API route (OmniRoute is supported).
ANTHROPIC_BASE_URL=http://localhost:YOUR_ROUTE_PORT
ANTHROPIC_MODEL=your-text-combo-or-model
ANTHROPIC_AUTH_TOKEN=your-route-token
# Alternatively use ANTHROPIC_API_KEY. AUTH_TOKEN takes precedence.
ANTHROPIC_WEB_SEARCH_TOOL=web_search_20250305

# A separately configured OpenAI-compatible Images API route.
YOUTUBE_LIVE_IMAGE_BASE_URL=https://api.openai.com
YOUTUBE_LIVE_IMAGE_MODEL=your-image-capable-model
YOUTUBE_LIVE_IMAGE_API_KEY=your-image-route-key
YOUTUBE_LIVE_IMAGE_SIZE=1536x1024
```

Use the actual base URL, model names, authentication mode, and web-search tool
version supported by your route. There is no assumption that every
Anthropic-compatible route supports server-side web search. Base URLs can include
`/v1`; complete `/messages` and `/images/generations` endpoints also work.
Image responses must include a base64 `b64_json` image. Returned image URLs are
not fetched. The image route receives `output_format=jpeg`, `quality=high`, and
the configured size; select a model that supports this contract.

Research and image generation may incur provider charges. This feature uses the
server's configured routes and does not deduct Creati credits. It limits concurrent
text requests and image generation. Keep credentials on the server, out of chat,
exports, screenshots, and committed files. Existing OpenAI text features keep
their existing configuration.

The researched preparation action requires successful research. An unavailable or
failed search is an error, not a generic package labeled as researched. A completed
search with no useful cited signal is labeled explicitly. Citations and the research
summary remain visible for review. Public niche examples are observations, not
proof that a design causes views. Growth is not guaranteed by packaging.

Image generation creates an actual landscape image using the researched direction
and viewer promise, then crops/scales it to a 1280 × 720 JPEG. Without a real
screenshot it requests clearly illustrative imagery, not fabricated gameplay,
scoreboards, victories, or a real person's reaction. You can regenerate the image
or use the optional local composer with your own screenshot. Local source images
are not sent to the model. Composer source/crop controls are local to the current
page; upload the finished image or download it before leaving.

Local or S3 storage must be configured and writable for saved/generated thumbnails.
The application thumbnail limit is 2 MB. Source uploads for local composition are
limited separately. A stored image is accessed through an owned draft endpoint.

## YouTube connection and approval

Configure `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `FRONTEND_URL`, and
`ENCRYPTION_KEY` using the existing setup. Enable the YouTube Data API for the
Google project and register this authorized redirect URI:

```text
<FRONTEND_URL>/platforms/youtube/callback
```

Use **Connect / enable YouTube Live**. Existing channels need to reconnect for
the additional `youtube.force-ssl` permission. New YouTube connections from the
Platforms page also use the session-bound flow; old in-flight numeric-state
callbacks are rejected and must be restarted. OAuth state expires in ten minutes
and can be used once in the initiating signed-in session.

The channel must be eligible for Live and custom thumbnails. The user explicitly
chooses privacy and the made-for-kids setting; AI does not choose these. Approved
channel/category/language/audience/privacy/time-zone preferences are saved in
PostgreSQL per user/workspace, automatically after edits and on approval. They
autofill the next live across browsers. Preferences from an existing approved
Creati broadcast are used if no preferences record exists yet. A blank time prepares an upcoming event five minutes from
approval; the review shows the actual time before submission. A future custom time
can be chosen under broadcast preferences. Monetization remains in YouTube Studio.

The server creates a broadcast, creates and binds its stream, updates metadata,
and applies the thumbnail. It records returned IDs and the approved settings.
Double submission reuses the existing result; partial setup retries preserve the
broadcast and retry remaining work. Approved settings are locked to that event.
Start another brief for a different event.

Use **Reuse a previous stream** to start a new editable draft from a Creati
broadcast or a broadcast on the selected YouTube channel. YouTube history loads
only when opened and supports **Load more streams**. Reuse copies the title,
description, tags, category, language, visibility, audience, and an available
thumbnail. The new draft has its own ID, no approval or YouTube event IDs, and an
empty schedule. The original broadcast is unchanged. An unavailable YouTube
thumbnail does not discard the copied details; generate or upload a replacement.
Imported material is labeled reused, and any saved research retains its original
dates. Run research again when current information is needed.

The history adapter follows YouTube's [broadcast listing](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list)
and [video metadata](https://developers.google.com/youtube/data/reference/rest/v3/videos/list) APIs.

If a create request times out before its ID is recorded, automatic recreation is
blocked. Check Studio; use the recovery controls with the existing broadcast ID
and, when needed, the stream resource ID. These are resource IDs, **not stream
keys**. The server verifies ownership and the approved event before resuming.
An absent or unidentifiable event needs manual reconciliation; do not create
duplicates to bypass an uncertain result. Interrupted requests become recoverable
after the draft's operation timeout and reload.

Stream keys are not returned, exported, or stored in the draft. Select the event
through OBS's YouTube connection or retrieve the key privately in Studio. Check
audio/video in Live Control Room and click Go Live there when required.

## Drafting without an AI route

Optional manual tools can copy the reusable prompt for a normal ChatGPT conversation,
edit a package, and compose/download an image. Prompt export does not make in-app
generation keyless. Drafts and exports remain usable without a connected channel.
Edits are kept in a per-user/workspace tab recovery draft; save server-side for
reliable reopening. Unsaved navigation prompts before leaving the page.

## Verification

```bash
cd backend
go test -race ./...
CREATI_TEST_DATABASE_URL="$DATABASE_URL" go test -race ./internal/api ./internal/db/repositories -run 'TestLive(HTTPPostgres|RepositoryPostgres)'
cd ../frontend
npm run build
npx eslint src/pages/YouTubeLive.tsx src/components/youtube-live/ThumbnailComposer.tsx src/lib/youtubeLive.ts
```

The PostgreSQL tests create and remove disposable schemas and require `CREATE`
privileges. They do not create an account/event in the application's schema.
Model, image, and YouTube calls in tests use local fakes. A live provider check
requires configured routes and a creator-approved test event; automated verification
must not start streaming.

## Source documents and current API contracts

- [Supplied producer brief](producer.md)
- [Supplied research](research.md) — dated October 18, 2026; its external statistics
  and announcements are research inputs, not independently verified product claims.
- [Implementation plan](../../YOUTUBE_LIVE_PLAN.md)
- [Anthropic web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Official OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [YouTube broadcast creation](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/insert)
- [YouTube native title/thumbnail tests](https://support.google.com/youtube/answer/16391400)

Native A/B testing remains a Studio workflow for eligible archives, not scheduled
Lives. Automatic Analytics ingestion, stream-key handling, OBS automation, and
starting/stopping streams are outside this release.
