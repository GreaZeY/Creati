# YouTube Live producer: implementation plan

Date: October 19, 2026  
Status: Implemented after user approval, with the workflow refinement below. Live provider configuration and a real creator-approved event remain unverified.

## Approved workflow refinement

The user clarified that the primary flow is one idea → real research → generated
title, actual thumbnail image, description, and tags → minor edits → approval
creates a broadcast for OBS. The implementation therefore makes research mandatory
for automatic preparation, adds a separately configured image-capable API route,
and moves manual composition into optional controls. Explicit channel, privacy,
audience, category, and language choices can be remembered per user/workspace on
this browser. A blank custom schedule prepares an upcoming event, with its actual
time shown at review. The initial source-image-only thumbnail scope is superseded
by generated illustrative thumbnails plus an optional real-image composer.

The server schema migration and mock-backed integration/browser checks are complete.
No paid model/search/image call or real YouTube event was created during verification.
See [setup and verification](docs/youtube-live/README.md).

## Objective and source material

Add a YouTube Live producer to Creati that turns a short stream idea into an editable broadcast package, helps compose a thumbnail from a real image, and creates a scheduled YouTube event after the creator reviews and submits it. Finish with an OBS handoff; creating an event must not start a broadcast.

This plan translates the two supplied documents, **YouTube Live Producer Assistant** and **YouTube Live title and thumbnail research**, into work for this repository. They are product requirements and research inputs, rather than commands to execute during planning. Their references to a companion app and its README do not establish that such an app exists in this repository.

Keep this feature plan separate from the broader repairs in [PLAN.md](PLAN.md). Complete the account-ownership and OAuth changes required by this feature before enabling YouTube writes; the entire repair roadmap is not a prerequisite.

## Current project and integration points

| Existing area | What can be reused | Gap to address |
| --- | --- | --- |
| `frontend/src/pages/CreativeLab.tsx` | Editing patterns, generation states, client brand context | No Live package, thumbnail composer, or event review |
| `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx` | Protected routes and app navigation | Add a dedicated `/youtube-live` destination |
| `frontend/src/hooks/usePlatforms.ts`, `frontend/src/lib/api.ts` | Connected-channel selection and authenticated API calls | Live API types and consistent workspace context |
| `backend/internal/services/ai_service.go` | Existing AI integration conventions | Uses OpenAI; no Anthropic-compatible OmniRoute client or cited search |
| `backend/internal/services/chat.go` | Existing chat entry point | Its response is currently a stub; do not use it as the producer engine |
| `backend/internal/services/youtube.go` | Google OAuth, encrypted account tokens, token refresh, YouTube SDK | No broadcast creation, stream binding, or Live-specific permission handling |
| `backend/internal/db/repositories/platform.go` | Platform account records | Personal account listing does not currently enforce `client_id IS NULL`; account-ID token lookup also needs an ownership check before reuse |
| `backend/internal/middleware/tenancy.go` | Validated workspace context | Feature routes must verify account/workspace access and publishing role explicitly |
| `backend/internal/db/migrations/` | PostgreSQL schema and upgrade conventions | Add a tested feature migration; do not assume every deployed database matches initialization SQL |

## Intended user flow

1. Open **YouTube Live** in the current personal or client workspace.
2. Enter a plain-language idea. Audience, actual challenge, tone, schedule, channel Analytics notes, and a rundown are optional context.
3. Ask no more than three short clarification questions, only when an answer materially changes the promise, accuracy, or event settings. Otherwise show assumptions and continue. Do not ask for stream keys.
4. Generate the package through the configured server AI connection, or copy a prepared prompt for manual use in ChatGPT without configuring an AI API key in Creati.
5. Review and edit titles, description, tags, rundown, research notes, and thumbnail direction. Copy individual fields or export the package as Markdown.
6. Optionally provide a real screenshot or portrait, compose a thumbnail, and download it.
7. Choose a connected YouTube channel and explicitly select schedule, visibility, audience setting, category, and language. Show the actual channel and local time zone in the final summary.
8. Submit **Create scheduled event**. Report the resulting YouTube URL and which setup steps succeeded. Keep partial failures recoverable.
9. Select the scheduled event in OBS, or obtain the server/key privately in YouTube Studio; verify audio/video and preview in Live Control Room, then go live there when required.

Prompt export and package drafting must work without a connected YouTube channel. AI generation needs a configured model route; event creation needs a permitted YouTube connection. These capabilities must have separate availability states.

## Required package contract

Store and validate structured fields, then render and export them. Do not make frontend behavior depend on parsing a long Markdown response.

| Section | Required contents |
| --- | --- |
| Recommended title | Copy-ready title, computed character count, viewer promise, angle, and subjective 1–5 scores for emotional pull, clarity, understanding, and concision |
| Alternatives | At most two materially different angles, with short rationales and computed counts |
| Freshness and audience fit | Dated evidence, source links, assumptions, and clearly labeled hypotheses; distinguish unsupported search, failed research, and a completed search with no useful trend |
| Description | Full editable description and a separately computed first-200-character preview; no claim that 200 characters is a ranking threshold |
| Rundown / chapters | Planned segment names when timing is unknown; timestamp chapters only from supplied actual timing |
| Tags | A concise, relevant list; no unrelated trending terms or promised discovery boost |
| Thumbnail direction | Paired title, focal subject, crop, background, contrast, optional text/cue, and a different concept only when useful |
| Event settings | Category, language, schedule/time zone, visibility, and audience choice; suggestions remain distinct from approved settings |
| OBS handoff | Event URL and an accurate checklist; no claim that OBS is configured or the broadcast is live |

Treat model output as untrusted data. Enforce title/description limits, array lengths, score ranges, valid URLs, and usable required fields on the server. Compute counts and previews rather than trusting model-provided numbers. Use consistent Unicode counting in Go and TypeScript and cover emoji/non-Latin text in tests. Preserve the user's edits if regeneration fails.

## Delivery phases

### Phase 1 — Contracts, source preservation, and draft foundation

- Preserve the supplied prompt and research as project documentation when implementation starts, clearly labeled with their original research date. Do not present unverified statistics or feature announcements as established facts.
- Define Go/TypeScript request and response types for the package, clarification questions, research status, approved event settings, and creation results.
- Add a small `youtube_live_drafts` model/repository and migration. Store ownership, input/context, editable package, composition settings, approved event snapshot, operation state, timestamps, and external resource IDs.
- Keep personal drafts and client drafts isolated. Every read and write must check the actor's authorized scope. A personal workspace query must not include accounts belonging to client workspaces.
- Use a request identifier and a payload fingerprint for event creation, scoped to the draft and actor. Avoid introducing a separate job engine or a general agent framework.
- Add fresh-schema and existing-schema migration tests. Determine the next migration number at implementation time instead of overwriting existing repairs.

**Acceptance:** Drafts can be saved/reopened with their edits intact; another user or unrelated workspace cannot read or change them; migration reapplication preserves existing records.

### Phase 2 — Package generation and prompt export

- Add a producer service with an injected model client and bounded request timeout. Keep prompt construction, package validation, and provider HTTP handling separate from Fiber handlers.
- Implement the brief's Anthropic-compatible OmniRoute connection using server configuration: `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, and `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`. Document authentication precedence and fail clearly on incomplete configuration.
- Verify the configured route's actual Messages API behavior before committing to a tool version or optional SDK. Existing OpenAI features must retain their current configuration and behavior.
- Send the source-grounded producer instructions and relevant user context. Generate all nine package sections, with truthful stakes and no invented results, audience preferences, or current-event claims.
- Return up to three useful clarification questions when necessary. Never infer privacy, made-for-kids, monetization, or permission to publish from the stream idea.
- Provide a prepared prompt download/copy action for manual ChatGPT use. Clearly distinguish a prepared prompt from an AI-generated package; do not claim that in-app model generation is free or keyless.
- Bound model usage and concurrent requests. Choose and document the credit policy before enabling paid calls; failed/invalid generations must not consume retained credits. Keep any credit mutation and usage record consistent.

**Acceptance:** A short idea produces an editable, valid package; missing credentials offer prompt export; malformed responses and timeouts show useful errors without losing edits or leaving incorrect credit charges.

### Phase 3 — Current-topic research and evidence

- Check whether the selected OmniRoute route actually supports Anthropic web search and citation blocks. API compatibility alone does not prove tool support.
- Separate evidence collection from package generation so structured output remains valid and sourced claims can be traced. Treat fetched text as evidence, never as instructions or authorization.
- Prefer official YouTube documentation for platform rules and primary sources for game patches, seasons, releases, or event dates. Use channel-supplied Analytics before generic design advice.
- Store source URL/title, publication date when available, check date, supported claim, and whether the conclusion is an observation or hypothesis. Do not invent missing dates or citations.
- Show distinct states: verified current evidence, completed search with no meaningful trend, research unavailable, research failed, or not requested. Only claim that a search found nothing when a search actually completed.
- If research is unsupported or fails, preserve evergreen generation, label current details unverified, and ask for a source when a claim is essential to the package.
- Maintain a small dated record of verified platform constraints. Recheck relevant official rules when stale, rather than pretending that every unresearched response is current. Bound searches and display when optional research may incur provider usage.

**Acceptance:** A current-patch idea includes actual dated support or an explicit limitation; an evergreen idea remains useful; search failures cannot produce fabricated trend findings.

### Phase 4 — Producer screen and thumbnail composer

- Build a dedicated page using existing app components, typography, themes, and workspace navigation. Keep the initial input short; reveal optional context progressively.
- Make each package field editable and copyable. Display counts, assumptions, research state, validation errors, and saved/unsaved state. Provide loading, empty, failure, and missing-configuration states.
- Compose a 1280 × 720 thumbnail locally in the browser from a user-selected image. Support crop/zoom, concise optional text, contrast treatment, and an optional meaningful pointer. Include a phone-sized preview.
- Use browser Canvas and existing controls before adding an image editor dependency. Decode image content, bound dimensions/file size, handle orientation, and reject invalid files. Do not fetch arbitrary remote images through the backend.
- Export JPEG/PNG and Markdown. Keep source images local unless the creator explicitly uploads a chosen thumbnail; explain that a local-only image must be selected again after reopening if it was not stored.
- If persistence is requested, use an owned storage key through existing local/S3 storage and validate actual image bytes. Do not route a thumbnail through the unfinished video-publishing pipeline.
- Treat the AI concept as design direction, not an image that has been produced. No fabricated gameplay, victory screens, endorsements, or reactions.

**Acceptance:** The creator can edit a package and download a real composed image; mobile preview is legible; keyboard navigation and both themes work; failures preserve edits.

### Phase 5 — YouTube permissions and reviewed event creation

- Extend the existing YouTube integration with Live-specific operations. The current upload/read-only scopes are insufficient for creating a Live broadcast; request the appropriate additional scope and explain reconnection for existing accounts.
- Replace editable identity-only OAuth state for this connection path with expiring, single-use state bound to the signed-in session and validated workspace. Verify channel/account ownership before resolving tokens or issuing any YouTube call.
- Check membership and publishing role for client workspaces. Never treat a client-supplied account ID, a domain, or a cached account list as sufficient authorization.
- Validate the approved snapshot server-side: title, description, category, language, tags, future schedule/time zone, visibility, and an explicit audience choice. Keep unknown compliance settings unresolved until the user chooses them.
- Create the broadcast, create its stream, and bind them. Set automatic start explicitly off, including correct SDK serialization of `false`; expose no start/transition-to-live action in this release.
- Apply category, language, and tags through the supported video metadata operation where necessary. The installed Go SDK's `LiveBroadcastSnippet` lacks category/language/tag fields; verify API/SDK support and preserve existing snippet values when updating.
- Upload the approved thumbnail optionally. Keep event creation and thumbnail success separate in the result.
- Persist returned broadcast/stream IDs after each step. Protect against double clicks and concurrent submissions. Retry only an incomplete known step; do not create a second broadcast to repair a failed thumbnail or metadata update.
- For an ambiguous create timeout, mark the operation as needing reconciliation. Check the channel's upcoming events and require explicit resolution when identification is uncertain; never blindly retry creation or attach a draft to an unrelated event.
- Keep keys and tokens out of model prompts, package exports, logs, and ordinary API responses. Use YouTube Studio for private stream-key retrieval in the initial release; do not persist stream keys.
- Existing request logging captures failed request bodies. Exclude/redact sensitive connection and Live payload fields before these routes are enabled, and avoid logging complete provider responses.

**Acceptance:** One reviewed submission creates one scheduled event and linked stream on the intended channel. The event does not go live automatically. Permission, eligibility, quota, metadata, thumbnail, and network failures show accurate results and recover without duplicate events.

### Phase 6 — OBS handoff, archive guidance, and release checks

- Show the watch URL, event summary, thumbnail result, and Live Control Room/Studio handoff only after actual creation. Keep draft/generated/created/needs-attention states visually distinct.
- Provide the OBS checklist from the brief. Do not install/configure OBS, ask users to paste a stream key, or claim the app has started streaming.
- Retain alternative packages for archive testing. Offer instructions for eligible YouTube Studio tests, rather than building an unsupported automated A/B testing feature.
- After the stream, allow actual timestamps/results to inform archive title and chapters. Never turn planned times or an uncertain outcome into claimed facts automatically.
- Document Linux and Windows setup, server environment, Google OAuth/reconnection, feature limitations, failures/retries, and the manual prompt-only path. No CLI OS changes are needed for this feature.

**Acceptance:** A creator can go from an idea to an approved scheduled event and an accurate OBS checklist. The manual workflow remains usable when AI search or YouTube creation is unavailable.

## Proposed API and persistence boundaries

Final naming may follow repository conventions during implementation; keep these responsibilities distinct.

| Endpoint under the authenticated API | Responsibility |
| --- | --- |
| `GET /youtube-live/capabilities` | Report model/search/connection availability without exposing secrets |
| `POST /youtube-live/drafts`, `GET /youtube-live/drafts/:id`, `PATCH /youtube-live/drafts/:id` | Create, reopen, and save an owned draft |
| `POST /youtube-live/drafts/:id/generate` | Generate questions or a validated package; persist only successful output |
| `POST /youtube-live/drafts/:id/create-event` | Validate the reviewed snapshot and create/resume its event operation |
| `GET /youtube-live/drafts/:id/event` | Return recorded result and reconcile safe status checks |
| `PUT /youtube-live/drafts/:id/thumbnail` | Optional owned image upload/replacement; an existing event must not be recreated |

Prompt preparation, clipboard actions, Markdown formatting, and local composition can run in the frontend. Backend authorization remains mandatory for saved drafts, generation, account selection, and YouTube writes. Use the existing CSRF/session mechanisms and propagate `X-Workspace-ID` consistently.

Suggested draft fields: UUID, user/client ownership, idea/context JSON, package JSON with schema version, approved settings, optional image storage key and composition settings, operation ID/fingerprint, creation step/status, broadcast/stream IDs, safe error summary, and timestamps. Persist no OAuth credentials or stream keys in the draft. Only add deletion/history endpoints if a concrete retention or UX requirement needs them.

Keep generation bounded and synchronous initially. Scheduling an upcoming event means creating it now with a future start time; a background job is not needed to make the event visible later. Add worker processing only if measured request duration requires it.

## Expected file changes during implementation

| Area | Proposed files |
| --- | --- |
| Product docs | `docs/youtube-live/producer.md`, `docs/youtube-live/research.md`, setup instructions |
| UI | `frontend/src/pages/YouTubeLive.tsx`, focused components under `frontend/src/components/youtube-live/`, route/sidebar registration |
| Frontend contract | Live types/API functions in `frontend/src/lib/api.ts` or a focused adjacent module |
| Application service | `backend/internal/services/youtube_live.go` plus a focused producer/model adapter |
| YouTube adapter | Extend `backend/internal/services/youtube.go` using the installed SDK where supported |
| API and authorization | `backend/internal/api/youtube_live.go`, route registration in `backend/internal/app/server.go`, targeted OAuth/account access fixes |
| Persistence | A draft model/repository, a new SQL migration, and updated initialization schema |
| Setup | `backend/.env.example`, relevant README sections, and `task.md` before implementation |
| Verification | Provider/handler tests, PostgreSQL integration fixtures, and focused browser checks |

These are proposed paths, not files created by this planning task. Avoid refactoring unrelated uploads, billing, platform adapters, or the global chat agent.

## Verification and release gates

1. **Package correctness:** Missing context, clarification limits, title limits/Unicode counts, invalid model JSON, false outcome claims, absent sources, unsupported search, rate limits, and timeouts.
2. **Database and ownership:** Fresh/upgrade/repeated migration fixtures; saved draft isolation; personal versus client channels; forbidden roles; forged/replayed OAuth state; unauthorized IDs rejected before a provider call.
3. **External side effects:** Fake HTTP/model/YouTube adapters verify request fields and explicit auto-start false, step persistence, duplicate submission handling, partial failure recovery, and ambiguous timeout reconciliation.
4. **Thumbnail behavior:** Invalid/large images, crop/orientation, actual 1280 × 720 output, legible small preview, copy/download failures, and denied thumbnail permission.
5. **Browser workflow:** Short idea through edit/export and reviewed creation; disconnected channel; workspace switching; unsaved edits; narrow viewport; keyboard access; light/dark themes. Inspect the actual rendered page, not only its build output.
6. **Project baseline:** Run backend tests with the race detector and frontend TypeScript/production build. Run lint for changed files and report existing repo failures separately. Run meaningful CLI checks only if CLI files change.
7. **Live integration:** After local checks, use a deliberately selected test channel and a creator-reviewed private/unlisted event. A test must not publish to an unrelated channel or start OBS/a stream. Paid model/search calls require configured credentials and an agreed usage policy.

Release drafting/export first if useful, but label scheduling unavailable until the permission and retry gates pass. No runtime integration was exercised as part of this plan.

## Platform facts checked for planning

- Broadcast insertion requires the `youtube` or `youtube.force-ssl` scope. Title, scheduled start, and privacy are required; the documented title limit is 100 characters and description limit is 5,000. Recheck before implementing validation. [Google: liveBroadcasts.insert](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/insert)
- Streams and broadcasts are separate resources; binding associates them. [Google: liveStreams.insert](https://developers.google.com/youtube/data/live/reference/rest/v3/liveStreams/insert), [Google: liveBroadcasts.bind](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/bind)
- Thumbnail upload uses a separate video endpoint and can fail because the channel lacks permission. Check current media constraints rather than copying a stale file-size limit into code. The proposed 1280 × 720 canvas is the product's output format. [Google: thumbnails.set](https://developers.google.com/youtube/data/reference/rest/v3/thumbnails/set)
- Additional video metadata can be updated through the video resource. Check required fields and replacement semantics before sending a partial snippet. [Google: videos.update](https://developers.google.com/youtube/data/reference/rest/v3/videos/update)
- Scheduled Lives are excluded from native A/B testing; Live Archives may qualify. Tests use watch time, and eligibility must be checked in Studio. [YouTube: A/B test titles and thumbnails](https://support.google.com/youtube/answer/16391400)
- Manual chapters require actual ascending timestamps starting at 00:00, at least three chapters, and segments of at least ten seconds. [YouTube: Video chapters](https://support.google.com/youtube/answer/9884579)
- Anthropic web search returns citation content and may return tool-level errors inside a successful HTTP response. Verify equivalent behavior through the selected OmniRoute route. [Anthropic: Web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)

The attached research's niche statistics, design trends, and September 2026 announcements were not independently established in this planning pass. They are research leads, not fixed product rules or promises of reach.

## Decisions to settle during implementation

- Actual OmniRoute base URL, model/combo, authentication mode, and search capability; provide credentials through server configuration, never chat or committed files.
- Generation/search cost policy and whether existing Creati credits apply. Do not invent a subscription tier or price in the UI.
- Which authorized test channel to use and whether agency members other than the owner may create events under current role policy.
- If persistent thumbnail source images are needed beyond local composition; download-first avoids storing them by default.

Recommended first implementation slice: Phase 1 and Phase 2, followed by research and the composer; enable reviewed YouTube writes only after Phase 5 verification. Direct OBS control, starting broadcasts, synthetic gameplay imagery, automated A/B experiments, and automatic YouTube Analytics ingestion are outside the first release.
