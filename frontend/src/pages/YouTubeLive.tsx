import { useEffect, useMemo, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import { AxiosError } from "axios";
import { ArrowUpRight, Check, Copy, Download, FileText, Radio, Save, Sparkles, Youtube, Search } from "lucide-react";
import { useClient } from "@/context/ClientContext";
import { useAuth } from "@/hooks/useAuth";
import { usePlatforms } from "@/hooks/usePlatforms";
import { ThumbnailComposer } from "@/components/youtube-live/ThumbnailComposer";
import { BroadcastPackageEditor } from "@/components/youtube-live/BroadcastPackageEditor";
import { LiveConnection } from "@/components/youtube-live/LiveConnection";
import { LiveReuse } from "@/components/youtube-live/LiveReuse";
import { useLivePreferences } from "@/components/youtube-live/useLivePreferences";
import { emptyPackage, liveAPI, newLiveEvent as newEvent, obsChecklist, type LiveCapabilities, type LiveDraft, type LiveEventSettings, type LivePackage } from "@/lib/youtubeLive";
import { PageHeader } from "@/components/ui/PageHeader";
import { LensedCard } from "@/components/ui/LensedCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Dropdown } from "@/components/ui/Dropdown";

function newDraft(): LiveDraft { return { id: "", idea: "", context: "", package: null, questions: [], state: "draft", step: "", event: null, broadcastId: "", streamId: "", hasThumbnail: false, error: "", updatedAt: "" }; }
function initialLocal(key: string): { draft: LiveDraft; event: LiveEventSettings } {
  try { const raw = JSON.parse(sessionStorage.getItem(key) || "null"); if (raw?.draft?.idea !== undefined && raw?.event) return raw; } catch { /* An invalid local recovery draft must not break the page. */ }
  return { draft: newDraft(), event: newEvent() };
}
export function YouTubeLive() {
  const { selectedClient } = useClient(); const { user } = useAuth();
  return <LiveWorkspace key={`${user?.id}:${selectedClient?.id || "personal"}`} userID={user?.id || 0} clientID={selectedClient?.id} />;
}
function LiveWorkspace({ userID, clientID }: { userID: number; clientID?: number }) {
  const client = useMemo(() => liveAPI(clientID), [clientID]);
  const recoveryKey = `creati-live:${userID}:${clientID || "personal"}`;
  const [local] = useState(() => initialLocal(recoveryKey));
  const [draft, setDraft] = useState(local.draft);
  const preferences = useLivePreferences(client, recoveryKey, local.draft.idea || local.draft.id ? local.event : undefined);
  const { event, setEvent } = preferences;
  const [saved, setSaved] = useState(""); const [drafts, setDrafts] = useState<LiveDraft[]>([]);
  const [capabilities, setCapabilities] = useState<LiveCapabilities | null>(null);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [recoveryBroadcast, setRecoveryBroadcast] = useState(""); const [recoveryStream, setRecoveryStream] = useState(""); const [review, setReview] = useState(false); const [thumbnailURL, setThumbnailURL] = useState("");
  const { connectedAccounts } = usePlatforms();
  const channels = connectedAccounts.filter(a => a.platform === "youtube");
  const dirty = Boolean(draft.idea) && JSON.stringify(draft) !== saved;
  const blocked = useBlocker(dirty);
  useEffect(() => {
    if (blocked.state === "blocked") { if (window.confirm("Leave this page? Unsaved package edits will be kept in this tab’s recovery draft.")) blocked.proceed(); else blocked.reset(); }
  }, [blocked]);
  useEffect(() => {
    try { sessionStorage.setItem(recoveryKey, JSON.stringify({ draft, event })); } catch { /* Server save and export still work when browser storage is full. */ }
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler);
  }, [draft, event, recoveryKey, dirty]);
  useEffect(() => {
    let active = true;
    void client.capabilities().then(r => { if (active) setCapabilities(r.data.data); }).catch(() => { if (active) setError("Could not load producer settings. Check the backend connection."); });
    void client.list().then(r => { if (active) setDrafts(r.data.data); }).catch(() => { if (active) setError("Saved drafts are unavailable. Apply the YouTube Live migration and reload."); });
    return () => { active = false; };
  }, [client]);
  useEffect(() => {
    if (!draft.id || !draft.hasThumbnail) return;
    let active = true; let objectURL = "";
    void client.getThumbnail(draft.id).then(r => { if (active) { objectURL = URL.createObjectURL(r.data); setThumbnailURL(objectURL); } }).catch(() => { if (active) setError("The saved thumbnail could not be loaded. Retry or generate another image."); });
    return () => { active = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [client, draft.id, draft.hasThumbnail, draft.updatedAt]);
  const adopt = (value: LiveDraft) => { setDraft(value); setSaved(JSON.stringify(value)); setDrafts(items => [value, ...items.filter(d => d.id !== value.id)].slice(0,30)); if (value.event) setEvent(value.event); };
  async function action(name: string, fn: () => Promise<void>) {
    if (busy) return; setBusy(name); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e instanceof AxiosError ? e.response?.data?.error || e.message : e instanceof Error ? e.message : "This action could not be completed."); }
    finally { setBusy(""); }
  }
  async function persist(): Promise<LiveDraft> {
    if (!draft.idea.trim()) throw new Error("Start with a stream idea.");
    let result = draft;
    if (!result.id) {
      result = (await client.create(draft.idea, draft.context)).data.data;
      if (draft.package) result = (await client.save({ ...result, package: draft.package })).data.data;
    } else if (dirty) result = (await client.save(draft)).data.data;
    adopt(result); setDrafts(items => [result, ...items.filter(d => d.id !== result.id)].slice(0, 30)); return result;
  }
  function updatePackage(change: Partial<LivePackage>) { setDraft(d => ({ ...d, package: { ...(d.package || emptyPackage()), ...change } })); setReview(false); }
  const pack = draft.package;
  const eventLocked = Boolean(draft.event);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard."); } catch { setError("Clipboard access was denied. Select the text to copy it manually."); } }
  function preparedPrompt() {
    return (capabilities?.prompt || "You are my YouTube Live producer. Prepare truthful titles, description, tags, thumbnail direction, event fields, and an OBS checklist. Ask at most three useful questions. Never invent results or current trends. Never ask for a stream key.\nIdea: [Your stream idea]\nContext: [Optional context]").replace("[Your stream idea]", () => draft.idea || "[Your stream idea]").replace("[Optional context]", () => draft.context || "[Optional context]");
  }
  async function generate() {
    const current = await persist(); const generated = (await client.generate(current.id, true)).data.data; adopt(generated);
    if (generated.questions?.length) { setNotice("A little context will make this more accurate. Add your answers to the brief."); return; }
    setNotice("Research and writing are ready. Generating your thumbnail…");
    setEvent(e => ({ ...e, category: e.category || generated.package?.category || "", language: e.language || generated.package?.language || "" }));
    const ready = (await client.generateThumbnail(generated.id)).data.data; adopt(ready);
    setNotice("Your researched package and thumbnail are ready. Make your changes, then approve.");
  }
  function approvedEvent(): LiveEventSettings {
    if (draft.event) return draft.event;
    if (!pack?.title.text) throw new Error("Write or generate a title first.");
    const date = event.scheduledStart ? new Date(event.scheduledStart) : new Date(Date.now() + 5 * 60000); if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Choose a future start time, or leave it blank to go live when ready.");
    if (!selectedChannel || !event.visibility || event.madeForKids === null || !(event.category || pack.category) || !(event.language || pack.language)) throw new Error("Select a channel, category, language, visibility, and audience before review.");
    return { ...event, accountId: selectedChannel, category: event.category || pack.category, language: event.language || pack.language, title: pack.title.text, description: pack.description, tags: pack.tags, scheduledStart: date.toISOString() };
  }
  async function createEvent() {
    const settings = approvedEvent();
    await preferences.flush(settings);
    const current = await persist(); const result = (await client.event(current.id, settings)).data.data; adopt(result); setReview(false);
    setNotice(result.state === "created" ? "Scheduled event created. OBS and Go Live are still in your control." : "Setup needs attention. The existing event will be preserved when you retry.");
  }
  const updateEvent = (change: Partial<LiveEventSettings>) => { const next = { ...event, ...change }; setEvent(next); preferences.remember(next); setReview(false); };
  const fieldClass = "space-y-2";
  const detailsClass = "space-y-4 border-t border-border pt-4 [&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-bold";
  const headingClass = "flex items-center gap-2 text-sm font-black tracking-tight";
  const mutedClass = "text-xs leading-relaxed text-muted-foreground";
  const fineClass = "text-[10px] leading-relaxed text-muted-foreground";
  const selectedChannel = eventLocked || channels.some(c => c.accountId === event.accountId) ? event.accountId : channels.length === 1 ? channels[0].accountId : 0;


  return (
    <div className="h-full min-h-0 w-full overflow-y-auto" aria-busy={Boolean(busy)} data-testid="youtube-live">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-10 pt-3 md:px-8">
        <Link className="text-xs text-muted-foreground md:hidden" to="/dashboard">← Back to Creati</Link>
        <PageHeader
          title="YouTube Live"
          description="Prepare your next broadcast."
          className="mt-0 gap-3 [&_h1]:text-2xl md:[&_h1]:text-3xl"
        >
          <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => {
            if (dirty && !window.confirm("Start another brief? Save or export these edits first.")) return;
            void action("new", async () => { await preferences.flush(); setDraft(newDraft()); preferences.reset(); setSaved(""); setReview(false); });
          }}>New brief</Button>
          <Button size="sm" disabled={Boolean(busy) || !draft.idea.trim()} isLoading={busy === "save"} loadingText="Saving…" onClick={() => void action("save", async () => {
            await preferences.flush(); await persist(); setNotice("Draft saved.");
          })}><Save size={14} /> Save draft</Button>
        </PageHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
            <FileText size={16} className="shrink-0 text-muted-foreground" />
            <Dropdown
              id="live-drafts"
              aria-label="Open saved draft"
              className="min-w-0 flex-1 !w-auto"
              disabled={Boolean(busy)}
              placeholder="New production brief"
              value={draft.id}
              items={drafts.map(d => ({ id: d.id, value: d.id, label: d.idea.slice(0, 55) }))}
              onChange={({ value }) => {
                const found = drafts.find(d => d.id === value);
                if (found && (!dirty || window.confirm("Open another draft? Save or export your current edits first."))) {
                  adopt(found); setEvent(found.event || newEvent(preferences.defaults)); setReview(false);
                }
              }}
            />
          </div>
          <span className={`${fineClass} shrink-0`}>{dirty ? "Unsaved edits" : draft.id ? "Draft saved" : "New brief"}</span>
        </div>

        <LiveReuse client={client} scope={recoveryKey} drafts={drafts} accountId={selectedChannel} disabled={Boolean(busy) || preferences.loading} onReuse={(source, id) => {
          if (dirty && !window.confirm("Reuse this stream? Save or export your current edits first.")) return;
          void action("reuse", async () => {
            await preferences.flush();
            const result = (await (source === "creati" ? client.reuse(id) : client.reuseYouTube(selectedChannel, id))).data.data;
            adopt(result.draft);
            const copied = Object.fromEntries(Object.entries(result.preferences).filter(([, value]) => value !== "" && value !== 0 && value !== null));
            const next = newEvent({ ...preferences.defaults, ...copied });
            setEvent(next); preferences.remember(next); setReview(false);
            setNotice(result.warning || "Previous stream copied into a new draft. Review the details and schedule before approval.");
          });
        }} />

        {error && (
          <LensedCard className="bg-destructive/5 p-3 ring-destructive/30">
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
              <p>{error}</p>
              {draft.id && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void action("reload", async () => adopt((await client.get(draft.id)).data.data))}>Reload saved draft</Button>}
            </div>
          </LensedCard>
        )}
        {notice && (
          <LensedCard className="p-3">
            <p role="status" className="flex items-center gap-2 text-sm"><Check size={16} className="shrink-0 text-primary" /> {notice}</p>
          </LensedCard>
        )}

        <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <aside className="min-w-0 space-y-5 xl:col-span-4">
            <LensedCard className="p-5">
              <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4">
                <legend className="sr-only">Stream brief</legend>
                <h2 className={headingClass}><Sparkles size={16} className="text-primary" /> Stream brief</h2>
                <div className={fieldClass}>
                  <Label htmlFor="live-idea">What are you going to stream?</Label>
                  <Textarea id="live-idea" rows={4} maxLength={4000} value={draft.idea} onChange={e => setDraft(d => ({ ...d, idea: e.target.value }))} placeholder="Ranked Valorant tonight. Chat picks my agent, and I’m aiming for Gold." />
                </div>
                <details className={detailsClass}>
                  <summary>Add context <span className="font-normal text-muted-foreground">(optional)</span></summary>
                  <div className={fieldClass}>
                    <Label htmlFor="live-context">Goal, audience, tone, or actual timing</Label>
                    <Textarea id="live-context" rows={5} maxLength={12000} value={draft.context} onChange={e => setDraft(d => ({ ...d, context: e.target.value }))} placeholder="Include real details or Analytics notes. Leave unknown timing out." />
                  </div>
                </details>
                <Button
                  className="w-full"
                  disabled={Boolean(busy) || preferences.loading || !capabilities?.generation || !capabilities.research || !capabilities.imageGeneration || !draft.idea.trim()}
                  isLoading={busy === "generate"}
                  loadingText="Researching & preparing…"
                  onClick={() => void action("generate", generate)}
                ><Sparkles size={16} /> Research & prepare my live</Button>
                <p className={fineClass}>Research: {capabilities?.research ? "connected" : "setup needed"} · Images: {capabilities?.imageGeneration ? "connected" : "setup needed"}</p>
                <p className={fineClass}>{capabilities?.usage || "Checking producer connection…"}</p>
                {capabilities && !capabilities.generation && <p className="rounded-xl bg-secondary/30 p-3 text-xs text-muted-foreground">Connect the research and image models to prepare automatically. Manual tools are available below.</p>}
                <details className={detailsClass}>
                  <summary>Manual tools</summary>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void copy(preparedPrompt())}><Copy size={14} /> Copy prompt</Button>
                    <Button size="sm" variant="ghost" onClick={() => updatePackage({})}>Write manually</Button>
                  </div>
                </details>
                {(draft.questions || []).length > 0 && (
                  <div className="space-y-2 rounded-xl bg-secondary/30 p-3 text-xs">
                    <p className="font-bold">A few useful details</p>
                    <ol className="list-inside list-decimal space-y-2">{draft.questions.map(q => <li key={q}>{q}</li>)}</ol>
                    <p className="text-muted-foreground">Add your answers under context, then generate again.</p>
                  </div>
                )}
              </fieldset>
            </LensedCard>

            <LensedCard className="space-y-4 p-5">
              <h2 className={headingClass}><Search size={16} className="text-primary" /> Research</h2>
              <p className="text-xs font-bold capitalize">{pack?.research.status.replaceAll("_", " ") || "Not researched"}</p>
              <p className={mutedClass}>{pack?.research.note || "Research findings and sources will appear with your package."}</p>
              {pack?.research.summary && <details className={detailsClass}><summary>View findings</summary><p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{pack.research.summary}</p></details>}
              {pack?.research.sources.filter(s => s.url.startsWith("https://")).map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block space-y-1 border-t border-border pt-3 text-xs">
                  <span className="flex items-center gap-2 break-all font-medium">{s.title || s.url}<ArrowUpRight size={13} className="shrink-0" /></span>
                  <span className="block text-muted-foreground">Checked {new Date(s.checkedAt).toLocaleDateString()}</span>
                </a>
              ))}
            </LensedCard>
          </aside>

          <div className="min-w-0 space-y-5 xl:col-span-8">
            {!pack ? (
              <EmptyState icon={Youtube} title="Your broadcast package" description="Describe your stream to prepare a researched title, thumbnail, description, and tags." actionLabel="Write manually" onAction={() => updatePackage({})} />
            ) : (
              <BroadcastPackageEditor draft={draft} disabled={Boolean(busy)} onChange={updatePackage} onCopy={copy} />
            )}

            <LensedCard className="space-y-4 p-5">
              <h2 className={headingClass}><Youtube size={16} className="text-primary" /> Thumbnail</h2>
              {draft.hasThumbnail && thumbnailURL ? (
                <><img src={thumbnailURL} alt="Generated or approved YouTube Live thumbnail" className="aspect-video w-full rounded-xl object-cover" /><Button size="sm" variant="outline" onClick={() => { const a = document.createElement("a"); a.href = thumbnailURL; a.download = "youtube-live-thumbnail.jpg"; a.click(); }}><Download size={15} /> Download thumbnail</Button></>
              ) : <p className={mutedClass}>Your thumbnail will appear here after research and generation.</p>}
              <Button size="sm" variant="outline" disabled={Boolean(busy) || !pack || !capabilities?.imageGeneration} isLoading={busy === "image"} loadingText="Generating…" onClick={() => void action("image", async () => { const current = await persist(); adopt((await client.generateThumbnail(current.id)).data.data); setNotice("New thumbnail ready for review."); })}><Sparkles size={15} /> {draft.hasThumbnail ? "Generate another thumbnail" : "Generate thumbnail"}</Button>
              <details className={detailsClass}><summary>Use or adjust your own screenshot</summary><ThumbnailComposer busy={Boolean(busy)} canUpload={Boolean(draft.idea.trim()) && Boolean(capabilities?.thumbnailUpload)} onError={setError} onUpload={blob => void action("thumbnail", async () => { const current = await persist(); adopt((await client.thumbnail(current.id, blob)).data.data); setNotice("Thumbnail saved for this event. Create or resume setup to apply it to YouTube."); })} /></details>
            </LensedCard>

            <LensedCard className="space-y-4 p-5">
              <h2 className={headingClass}><Radio size={16} className="text-primary" /> Broadcast settings</h2>
              <p className={mutedClass}>Review your channel and saved preferences, then approve. A blank schedule prepares an upcoming event; you start streaming from OBS.</p>
              <LiveConnection accountId={selectedChannel} disabled={Boolean(busy)} connecting={busy === "connect"} onConnect={() => void action("connect", async () => { if (dirty) await persist(); const response = await client.connect(); window.location.assign(response.data.data.authUrl); })} />
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span role="status">{preferences.loading ? "Loading saved preferences…" : preferences.error ? "Preferences could not be saved or loaded." : preferences.saving ? "Saving preferences…" : "Preferences saved in your account for your next live."}</span>{preferences.error && <Button size="sm" variant="ghost" onClick={() => void preferences.retry()}>Retry preferences</Button>}</div>
              <details className={detailsClass} open={!event.visibility || event.madeForKids === null}>
                <summary>Channel & preferences <span className="font-normal text-muted-foreground">(saved for your next live)</span></summary>
                <fieldset disabled={Boolean(busy) || eventLocked || preferences.loading} className="min-w-0 space-y-4">
                  <legend className="sr-only">Event settings</legend>
                  <div className={fieldClass}><Label htmlFor="live-channel">YouTube channel</Label><Dropdown id="live-channel" aria-label="YouTube channel" className="!w-full" disabled={Boolean(busy) || eventLocked} placeholder="Choose a channel" value={selectedChannel} items={channels.map(c => ({ id: c.accountId, value: c.accountId, label: c.profileName || c.handle || c.name }))} onChange={({ value }) => updateEvent({ accountId: value })} /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className={fieldClass}><Label htmlFor="live-schedule">Optional time ({event.timeZone})</Label><Input id="live-schedule" type="datetime-local" value={event.scheduledStart.endsWith("Z") ? new Date(new Date(event.scheduledStart).getTime() - new Date(event.scheduledStart).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : event.scheduledStart} onChange={e => updateEvent({ scheduledStart: e.target.value })} /></div>
                    <div className={fieldClass}><Label htmlFor="live-visibility">Visibility</Label><Dropdown id="live-visibility" aria-label="Visibility" className="!w-full" disabled={Boolean(busy) || eventLocked} placeholder="Choose visibility" value={event.visibility} items={["private", "unlisted", "public"].map(value => ({ id: value, value, label: value.charAt(0).toUpperCase() + value.slice(1) }))} onChange={({ value }) => updateEvent({ visibility: value })} /></div>
                    <div className={fieldClass}><Label htmlFor="live-category">Category</Label><Dropdown id="live-category" aria-label="Category" className="!w-full" disabled={Boolean(busy) || eventLocked} placeholder="Choose a category" value={event.category || pack?.category || ""} items={[["20", "Gaming"], ["27", "Education"], ["22", "People & Blogs"], ["24", "Entertainment"], ["28", "Science & Technology"], ["10", "Music"], ["17", "Sports"]].map(([value, label]) => ({ id: value, value, label }))} onChange={({ value }) => updateEvent({ category: value })} /></div>
                    <div className={fieldClass}><Label htmlFor="live-language">Language code</Label><Input id="live-language" placeholder="en, hi, en-US…" value={event.language || pack?.language || ""} onChange={e => updateEvent({ language: e.target.value })} /></div>
                  </div>
                  <div className={fieldClass}><Label htmlFor="live-audience">Is this stream made for kids?</Label><Dropdown id="live-audience" aria-label="Is this stream made for kids?" className="!w-full" disabled={Boolean(busy) || eventLocked} placeholder="Choose the audience setting yourself" value={event.madeForKids} items={[{ id: "no", value: false, label: "No, it’s not made for kids" }, { id: "yes", value: true, label: "Yes, it’s made for kids" }]} onChange={({ value }) => updateEvent({ madeForKids: value })} /></div>
                </fieldset>
              </details>
              {draft.event && <p className="rounded-xl bg-secondary/30 p-3 text-xs text-muted-foreground">Submitted settings are locked to this event. Start another brief for a different broadcast.</p>}
              {draft.broadcastId && <div className="space-y-2 rounded-xl bg-secondary/30 p-4" data-testid="live-event-result"><p className="text-xs font-bold capitalize">{draft.state.replaceAll("_", " ")} · {draft.step}</p><Button size="sm" variant="link" asChild><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(draft.broadcastId)}`} target="_blank" rel="noreferrer">Open YouTube event <ArrowUpRight size={15} /></a></Button><p className={mutedClass}>{draft.error || "Your event is scheduled. The stream is not live."}</p></div>}
              {!draft.broadcastId && draft.error && <p className="text-xs text-destructive">{draft.error}</p>}
              {draft.state === "needs_attention" && <details className={detailsClass}><summary>Recover an interrupted setup</summary><p className={mutedClass}>Check YouTube Studio first. Use resource IDs, never a stream key.</p><div className={fieldClass}><Label htmlFor="live-recovery-broadcast">Existing broadcast ID</Label><Input id="live-recovery-broadcast" value={recoveryBroadcast || draft.broadcastId} onChange={e => setRecoveryBroadcast(e.target.value)} /></div><div className={fieldClass}><Label htmlFor="live-recovery-stream">Existing stream resource ID (when needed)</Label><Input id="live-recovery-stream" value={recoveryStream || draft.streamId} onChange={e => setRecoveryStream(e.target.value)} /></div><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void action("reconcile", async () => adopt((await client.reconcile(draft.id, recoveryBroadcast || draft.broadcastId, recoveryStream || draft.streamId)).data.data))}>Verify existing event</Button></details>}
              {draft.state !== "created" && <Button disabled={Boolean(busy) || !pack?.title.text || !draft.hasThumbnail} onClick={() => { try { const settings = approvedEvent(); setEvent(settings); setReview(true); setError(""); } catch (e) { setError((e as Error).message); } }}>{draft.event ? "Review unfinished setup" : "Review & approve"}<ArrowUpRight size={16} /></Button>}
              {review && <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" role="region" aria-label="Event creation review"><h3 className="font-bold">{draft.event?.title || pack?.title.text}</h3><p className={mutedClass}>{channels.find(c => c.accountId === event.accountId)?.profileName || "Selected channel"} · {event.visibility} · {new Date(event.scheduledStart).toLocaleString()} ({event.timeZone})</p><p className={mutedClass}>Thumbnail ready · {event.madeForKids ? "Made for kids" : "Not made for kids"} · Automatic start off</p><p className={fineClass}>Review accuracy, rights, and any monetization settings in YouTube Studio.</p><div className="flex flex-wrap gap-2"><Button size="sm" disabled={Boolean(busy)} isLoading={busy === "event"} loadingText="Creating…" onClick={() => void action("event", createEvent)}><Radio size={15} />{draft.event ? "Resume setup" : "Approve & create broadcast"}</Button><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setReview(false)}>Keep editing</Button></div></div>}
            </LensedCard>

            <LensedCard className="space-y-4 p-5">
              <h2 className={headingClass}>OBS handoff</h2>
              <ol className="list-inside list-decimal space-y-3 text-xs leading-relaxed text-muted-foreground">{obsChecklist.map(step => <li key={step}>{step}</li>)}</ol>
              <p className={fineClass}>Packaging helps viewers recognize the promise. Reach also depends on watch time, retention, and viewer satisfaction.</p>
            </LensedCard>
          </div>
        </div>
      </div>
    </div>
  );
}
