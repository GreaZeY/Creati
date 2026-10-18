import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { type liveAPI, type LiveDraft } from "@/lib/youtubeLive";

interface Props {
  client: ReturnType<typeof liveAPI>;
  scope: string;
  drafts: LiveDraft[];
  accountId: number;
  disabled: boolean;
  onReuse: (source: "creati" | "youtube", id: string) => void;
}
export function LiveReuse({ client, scope, drafts, accountId, disabled, onReuse }: Props) {
  const previous = drafts.filter(d => d.broadcastId && d.event);
  const [source, setSource] = useState<"creati" | "youtube">(previous.length ? "creati" : "youtube");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const history = useInfiniteQuery({
    queryKey: ["youtube-live-history", scope, accountId],
    queryFn: async ({ pageParam }) => (await client.history(accountId, pageParam)).data.data,
    initialPageParam: "",
    getNextPageParam: page => page.nextPageToken || undefined,
    enabled: open && source === "youtube" && accountId > 0,
  });
  const items = source === "creati"
    ? previous.map(d => ({ id: d.id, value: d.id, label: `${d.event?.title || d.idea} · ${new Date(d.updatedAt).toLocaleDateString()}` }))
    : [...new Map((history.data?.pages.flatMap(p => p.items) || []).map(item => [item.id, item])).values()].map(item => ({ id: item.id, value: item.id, label: `${item.title}${item.startedAt ? ` · ${new Date(item.startedAt).toLocaleDateString()}` : ""}` }));
  const selectedId = items.some(item => item.id === selected) ? selected : "";
  return (
    <details className="space-y-3 rounded-xl border border-border p-3" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-xs font-bold">Reuse a previous stream</summary>
      <p className="text-xs text-muted-foreground">Continue the same game with a new draft. Review copied details and choose a new schedule.</p>
      <div className="flex gap-2">{(["creati", "youtube"] as const).map(value => <Button key={value} size="sm" variant={source === value ? "secondary" : "ghost"} disabled={disabled} onClick={() => { setSource(value); setSelected(""); }}>{value === "creati" ? "Creati" : "YouTube"}</Button>)}</div>
      {source === "youtube" && !accountId ? <p className="text-xs text-muted-foreground">Choose a connected channel in broadcast settings to load its streams.</p> : source === "youtube" && history.isPending ? <p role="status" className="text-xs text-muted-foreground">Loading YouTube streams…</p> : source === "youtube" && history.isError ? <div className="space-y-2"><p role="alert" className="text-xs text-destructive">Could not load streams. Check your YouTube connection and Live access.</p><Button size="sm" variant="outline" onClick={() => void history.refetch()}>Retry history</Button></div> : (
        <div className="space-y-2">
          <Dropdown id="live-reuse-source" aria-label="Previous stream" className="!w-full" disabled={disabled || !items.length} placeholder={items.length ? "Choose a previous stream" : "No previous streams found"} items={items} value={selectedId} onChange={item => setSelected(item.value)} />
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={disabled || !selectedId} onClick={() => onReuse(source, selectedId)}><Copy size={14} /> Reuse stream details</Button>{source === "youtube" && history.hasNextPage && <Button size="sm" variant="ghost" isLoading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Load more streams</Button>}</div>
        </div>
      )}
    </details>
  );
}
