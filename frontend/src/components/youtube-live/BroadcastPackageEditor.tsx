import { Copy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LensedCard } from "@/components/ui/LensedCard";
import { Textarea } from "@/components/ui/Textarea";
import { countCharacters, downloadFile, packageMarkdown, type LiveDraft, type LivePackage } from "@/lib/youtubeLive";
import { LiveTagsInput } from "./LiveTagsInput";

interface Props {
  draft: LiveDraft;
  disabled: boolean;
  onChange: (change: Partial<LivePackage>) => void;
  onCopy: (value: string) => Promise<void>;
}

export function BroadcastPackageEditor({ draft, disabled, onChange, onCopy }: Props) {
  const pack = draft.package;
  if (!pack) return null;
  const fieldClass = "space-y-2";
  const detailsClass = "space-y-4 border-t border-border pt-4 [&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-bold";
  const headingClass = "flex items-center gap-2 text-sm font-black tracking-tight";
  const fineClass = "text-[10px] leading-relaxed text-muted-foreground";

  return (
    <LensedCard className="p-5">
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="sr-only">Broadcast package</legend>
        <div className="flex items-center justify-between gap-3">
          <h2 className={headingClass}><FileText size={16} className="text-primary" /> Broadcast package</h2>
          <Button size="icon" variant="ghost" aria-label="Download package as Markdown" onClick={() => downloadFile(new Blob([packageMarkdown(draft)], { type: "text/markdown" }), "youtube-live-package.md")}><Download size={16} /></Button>
        </div>
        <div className={fieldClass}>
          <div className="flex items-center justify-between gap-2"><Label htmlFor="live-title">Title</Label><span className={countCharacters(pack.title.text) > 100 ? "text-xs text-destructive" : fineClass}>{countCharacters(pack.title.text)} / 100</span></div>
          <Input id="live-title" value={pack.title.text} onChange={e => onChange({ title: { ...pack.title, text: e.target.value } })} placeholder="Give your stream a clear, specific title" />
          <Button size="sm" variant="ghost" onClick={() => void onCopy(pack.title.text)}><Copy size={13} /> Copy title</Button>
        </div>
        <details className={detailsClass}>
          <summary>Why this title · alternatives & assumptions</summary>
          <div className={fieldClass}><Label htmlFor="live-promise">Viewer promise</Label><Input id="live-promise" value={pack.title.promise} onChange={e => onChange({ title: { ...pack.title, promise: e.target.value } })} /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{["Emotional pull", "Clarity", "Understanding", "Concision"].map((label, i) => <div key={label} className="rounded-xl bg-secondary/30 p-3"><p className={fineClass}>{label}</p><p className="text-lg font-bold">{pack.title.scores[i]}<span className="text-xs font-normal text-muted-foreground"> / 5</span></p></div>)}</div>
          <p className={fineClass}>Subjective scores, not YouTube scores or view predictions. {pack.title.rationale}</p>
          {pack.alternatives.map((t, i) => <div key={i} className="space-y-2 border-t border-border pt-3"><p className="text-xs font-bold text-primary">{t.angle || `Alternative ${i + 1}`}</p><p className="text-sm font-medium">{t.text}</p><p className={fineClass}>{countCharacters(t.text)} characters · {t.rationale}</p><Button size="sm" variant="outline" onClick={() => onChange({ title: t, alternatives: pack.alternatives.map((a, index) => index === i ? pack.title : a) })}>Use this angle</Button></div>)}
          {pack.assumptions.length > 0 && <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">{pack.assumptions.map(a => <li key={a}>{a}</li>)}</ul>}
        </details>
        <div className={fieldClass}>
          <div className="flex items-center justify-between gap-2"><Label htmlFor="live-description">Description</Label><span className={countCharacters(pack.description) > 5000 ? "text-xs text-destructive" : fineClass}>{countCharacters(pack.description)} / 5,000</span></div>
          <Textarea id="live-description" rows={6} value={pack.description} onChange={e => onChange({ description: e.target.value })} />
          <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">First 200 characters</summary><p className="mt-2 whitespace-pre-wrap rounded-xl bg-secondary/30 p-3">{Array.from(pack.description).slice(0, 200).join("") || "Your first visible lines will appear here."}</p></details>
          <Button size="sm" variant="ghost" onClick={() => void onCopy(pack.description)}><Copy size={13} /> Copy description</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldClass}><Label htmlFor="live-rundown">Rundown / supplied chapters</Label><Textarea id="live-rundown" rows={4} value={pack.rundown.join("\n")} onChange={e => onChange({ rundown: e.target.value.split("\n") })} placeholder={"Warm-up\nMain challenge\nCommunity Q&A"} /><p className={fineClass}>Use segment names until you have actual timestamps.</p></div>
          <div className={fieldClass}><Label htmlFor="live-tags">Tags</Label><LiveTagsInput key={draft.id || "new"} id="live-tags" value={pack.tags} disabled={disabled} onChange={tags => onChange({ tags })} /></div>
        </div>
        <details className={detailsClass}><summary>Thumbnail direction</summary>{Object.entries(pack.thumbnail).map(([key, value]) => <div className={fieldClass} key={key}><Label htmlFor={`live-thumbnail-${key}`} className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label><Input id={`live-thumbnail-${key}`} value={value} onChange={e => onChange({ thumbnail: { ...pack.thumbnail, [key]: e.target.value } })} /></div>)}</details>
      </fieldset>
    </LensedCard>
  );
}
