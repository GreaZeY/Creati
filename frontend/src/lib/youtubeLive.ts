import { api, type ApiResponse } from "./api";

export interface LiveTitle {
  text: string; promise: string; angle: string; rationale: string;
  scores: [number, number, number, number]; characters: number;
}
export interface LivePackage {
  title: LiveTitle; alternatives: LiveTitle[]; assumptions: string[];
  description: string; first200: string; rundown: string[]; tags: string[];
  thumbnail: { concept: string; focalPoint: string; crop: string; background: string; contrast: string; overlay: string; cue: string };
  category: string; language: string;
  research: { status: string; note: string; summary?: string; sources: { title: string; url: string; checkedAt: string }[] };
}
export interface LiveEventSettings {
  accountId: number; title: string; description: string; tags: string[];
  category: string; language: string; scheduledStart: string; timeZone: string;
  visibility: string; madeForKids: boolean | null;
}
export interface LiveDraft {
  id: string; idea: string; context: string; package: LivePackage | null;
  questions: string[]; state: string; step: string; event: LiveEventSettings | null;
  broadcastId: string; streamId: string; hasThumbnail: boolean; error: string; updatedAt: string;
}
export interface LiveCapabilities { generation: boolean; research: boolean; imageGeneration: boolean; prompt: string; usage: string; thumbnailUpload: boolean }
export type LivePreferences = Pick<LiveEventSettings, "accountId" | "category" | "language" | "visibility" | "madeForKids" | "timeZone">;
export interface LiveHistoryPage { items: { id: string; title: string; startedAt: string }[]; nextPageToken: string }
export interface LiveReuseResult { draft: LiveDraft; preferences: LivePreferences; warning?: string }
export function livePreferences(event: LiveEventSettings): LivePreferences {
  const { accountId, category, language, visibility, madeForKids, timeZone } = event;
  return { accountId, category, language, visibility, madeForKids, timeZone };
}
export function newLiveEvent(preferences?: Partial<LivePreferences>): LiveEventSettings {
  return { accountId: 0, title: "", description: "", tags: [], category: "", language: "", scheduledStart: "", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, visibility: "", madeForKids: null, ...preferences };
}
export const emptyPackage = (): LivePackage => ({
  title: { text: "", promise: "", angle: "Manual draft", rationale: "", scores: [3, 3, 3, 3], characters: 0 },
  alternatives: [], assumptions: [], description: "", first200: "", rundown: [], tags: [],
  thumbnail: { concept: "", focalPoint: "", crop: "", background: "", contrast: "", overlay: "", cue: "" },
  category: "", language: "", research: { status: "not_requested", note: "Current details have not been researched.", sources: [] },
});
export const countCharacters = (value: string) => Array.from(value).length;
export function liveAPI(clientId?: number) {
  const config = { headers: clientId ? { "X-Workspace-ID": String(clientId) } : {}, timeout: 180000, enableAlerts: false };
  const base = "/youtube-live";
  return {
    capabilities: () => api.get<ApiResponse<LiveCapabilities>>(`${base}/capabilities`, config),
    preferences: () => api.get<ApiResponse<LivePreferences>>(`${base}/preferences`, config),
    savePreferences: (preferences: LivePreferences) => api.put<ApiResponse<LivePreferences>>(`${base}/preferences`, preferences, config),
    reuse: (id: string) => api.post<ApiResponse<LiveReuseResult>>(`${base}/drafts/${id}/reuse`, {}, config),
    history: (accountId: number, pageToken: string) => api.get<ApiResponse<LiveHistoryPage>>(`${base}/channels/${accountId}/history`, { ...config, params: { pageToken } }),
    reuseYouTube: (accountId: number, broadcastId: string) => api.post<ApiResponse<LiveReuseResult>>(`${base}/channels/${accountId}/history/${encodeURIComponent(broadcastId)}/reuse`, {}, config),
    list: () => api.get<ApiResponse<LiveDraft[]>>(`${base}/drafts`, config),
    create: (idea: string, context: string) => api.post<ApiResponse<LiveDraft>>(`${base}/drafts`, { idea, context }, config),
    save: (draft: LiveDraft) => api.patch<ApiResponse<LiveDraft>>(`${base}/drafts/${draft.id}`, draft, config),
    get: (id: string) => api.get<ApiResponse<LiveDraft>>(`${base}/drafts/${id}`, config),
    generate: (id: string, research: boolean) => api.post<ApiResponse<LiveDraft>>(`${base}/drafts/${id}/generate`, { research, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, config),
    generateThumbnail: (id: string) => api.post<ApiResponse<LiveDraft>>(`${base}/drafts/${id}/generate-thumbnail`, {}, config),
    reconcile: (id: string, broadcastId: string, streamId: string) => api.post<ApiResponse<LiveDraft>>(`${base}/drafts/${id}/reconcile`, { broadcastId, streamId }, config),
    getThumbnail: (id: string) => api.get<Blob>(`${base}/drafts/${id}/thumbnail`, { ...config, responseType: "blob" }),
    event: (id: string, event: LiveEventSettings) => api.post<ApiResponse<LiveDraft>>(`${base}/drafts/${id}/create-event`, event, config),
    thumbnail: (id: string, image: Blob) => api.put<ApiResponse<LiveDraft>>(`${base}/drafts/${id}/thumbnail`, image, { ...config, headers: { ...config.headers, "Content-Type": image.type } }),
    connect: () => api.post<ApiResponse<{ authUrl: string }>>(`${base}/connect`, {}, config),
  };
}
export function packageMarkdown(draft: LiveDraft): string {
  const p = draft.package;
  if (!p) return `# YouTube Live brief\n\n${draft.idea}\n\n${draft.context}`;
  return `# YouTube Live package\n\n## Recommended title\n${p.title.text}\n\n${countCharacters(p.title.text)} characters\n\nViewer promise: ${p.title.promise}\n\nSubjective scores (emotion, clarity, understanding, concision): ${p.title.scores.join(" / ")}\n\n## Alternatives\n${p.alternatives.map(t => `- ${t.text} (${countCharacters(t.text)} characters) — ${t.rationale}`).join("\n")}\n\n## Assumptions\n${p.assumptions.join("\n")}\n\n## Freshness and audience fit\n${p.research.status}: ${p.research.note}\n${p.research.sources.map(s => `- ${s.title}: ${s.url} (checked ${s.checkedAt})`).join("\n")}\n\n## Description — first 200 characters\n${Array.from(p.description).slice(0, 200).join("")}\n\n## Full description\n${p.description}\n\n## Planned rundown / supplied chapters\n${p.rundown.join("\n")}\n\n## Tags\n${p.tags.join(", ")}\n\n## Thumbnail direction\n${Object.entries(p.thumbnail).map(([key, value]) => `${key}: ${value}`).join("\n")}\n\n## Event fields\n${draft.event ? JSON.stringify(draft.event, null, 2) : `Category suggestion: ${p.category || "Choose"}\nLanguage suggestion: ${p.language || "Choose"}\nSchedule, visibility, audience: creator must choose.`}\n\n## OBS checklist\n${obsChecklist.map(s => `- [ ] ${s}`).join("\n")}\n${draft.broadcastId ? `\nEvent: https://www.youtube.com/watch?v=${encodeURIComponent(draft.broadcastId)}` : "\nThis package has not created an event."}\n`;
}
export const obsChecklist = [
  "Select this scheduled YouTube event in OBS, or get the server and stream key privately from YouTube Studio.",
  "Keep the stream key private; never paste it into chat or this package.",
  "Check microphone, desktop audio, scene, video quality, and the preview in YouTube Live Control Room.",
  "Start sending video from OBS, then click Go Live in Live Control Room when your setup requires it.",
  "After the stream, use actual results/times for archive titles and chapters. Test alternatives in Studio only when the archive is eligible.",
];
export function downloadFile(data: Blob, name: string) {
  const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
