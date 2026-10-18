import { useEffect, useRef, useState } from "react";
import { ImagePlus, Download, Upload, MoveUpRight } from "lucide-react";
import { downloadFile } from "@/lib/youtubeLive";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";

interface Props { busy: boolean; canUpload: boolean; onUpload: (blob: Blob) => void; onError: (message: string) => void }
export function ThumbnailComposer({ busy, canUpload, onUpload, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phone = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1); const [x, setX] = useState(50); const [y, setY] = useState(50);
  const [text, setText] = useState(""); const [shade, setShade] = useState(35); const [arrow, setArrow] = useState(false);
  useEffect(() => () => image?.close(), [image]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#14171b"; ctx.fillRect(0, 0, 1280, 720);
    if (image) {
      const scale = Math.max(1280 / image.width, 720 / image.height) * zoom;
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image, -(width - 1280) * x / 100, -(height - 720) * y / 100, width, height);
      const gradient = ctx.createLinearGradient(0, 720, 1000, 0);
      gradient.addColorStop(0, `rgba(0,0,0,${shade / 100})`); gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
    }
    if (text) {
      ctx.font = "900 84px sans-serif"; ctx.lineWidth = 8; ctx.strokeStyle = "#111"; ctx.fillStyle = "white";
      const words = text.trim().split(/\s+/); const lines: string[] = []; let line = "";
      for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > 1100 && line) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line);
      lines.slice(0, 3).forEach((value, index) => { const top = 650 - (Math.min(lines.length, 3) - 1 - index) * 100; ctx.strokeText(value, 60, top, 1120); ctx.fillText(value, 60, top, 1120); });
    }
    if (arrow) {
      ctx.strokeStyle = "#f9e45b"; ctx.lineWidth = 15; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(950, 200); ctx.lineTo(1100, 110); ctx.lineTo(1055, 200); ctx.moveTo(1100, 110); ctx.lineTo(995, 110); ctx.stroke();
    }
    if (canvas.current) phone.current?.getContext("2d")?.drawImage(canvas.current, 0, 0, 320, 180);
  }, [image, zoom, x, y, text, shade, arrow]);
  async function choose(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) { onError("Choose a JPEG, PNG, or WebP image under 12 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width * bitmap.height > 40_000_000 || bitmap.width < 320 || bitmap.height < 180) { bitmap.close(); onError("Use an image at least 320 × 180 and at most 40 megapixels."); return; }
      setImage(bitmap); setZoom(1); setX(50); setY(50);
    } catch { onError("This image could not be decoded."); }
  }
  function exportImage(upload: boolean) {
    canvas.current?.toBlob(blob => {
      if (!blob) { onError("Thumbnail export failed."); return; }
      if (blob.size > 2 * 1024 * 1024) { onError("Export is larger than 2 MB. Try a simpler image."); return; }
      if (upload) onUpload(blob); else downloadFile(blob, "youtube-live-thumbnail.jpg");
    }, "image/jpeg", 0.88);
  }
  const controls = [
    { id: "zoom", label: "Zoom", value: zoom, min: 1, max: 3, step: .05, set: setZoom },
    { id: "crop-x", label: "Horizontal crop", value: x, min: 0, max: 100, step: 1, set: setX },
    { id: "crop-y", label: "Vertical crop", value: y, min: 0, max: 100, step: 1, set: setY },
    { id: "contrast", label: "Backdrop contrast", value: shade, min: 0, max: 85, step: 1, set: setShade },
  ];

  return (
    <section className="space-y-4" aria-labelledby="thumbnail-title">
      <h3 id="thumbnail-title" className="text-sm font-bold">Thumbnail editor</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">Choose a screenshot or portrait. The source image stays on this device until you use the finished thumbnail.</p>
      <input ref={fileInput} className="sr-only" aria-label="Choose thumbnail image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary">
        <canvas ref={canvas} className="block h-auto w-full" width={1280} height={720} aria-label="1280 by 720 thumbnail preview" />
        {!image && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"><Button variant="outline" className="border-white/30 text-white hover:text-white" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={18} /> Choose an image</Button><span className="text-[10px] text-white/60">JPEG, PNG, WebP · up to 12 MB</span></div>}
      </div>
      <fieldset disabled={busy || !image} className="min-w-0 space-y-4">
        <legend className="sr-only">Thumbnail adjustments</legend>
        <div className="space-y-2"><Label htmlFor="thumbnail-overlay">Optional overlay</Label><Input id="thumbnail-overlay" value={text} maxLength={55} onChange={e => setText(e.target.value)} placeholder="A clue the title doesn’t give away" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{controls.map(control => <div key={control.id} className="space-y-2"><Label htmlFor={`thumbnail-${control.id}`}>{control.label}</Label><Slider id={`thumbnail-${control.id}`} className="h-5" min={control.min} max={control.max} step={control.step} value={control.value} onValueChange={control.set} /></div>)}</div>
        <div className="flex items-center gap-3"><Switch id="thumbnail-pointer" checked={arrow} onCheckedChange={setArrow} disabled={busy || !image} size="sm" /><Label htmlFor="thumbnail-pointer" className="flex items-center gap-2"><MoveUpRight size={14} /> Show a pointer</Label></div>
      </fieldset>
      <div className={image ? "max-w-60 space-y-2" : "hidden"}><canvas ref={phone} className="block h-auto w-full rounded-xl" width={320} height={180} aria-label="Phone-size thumbnail preview" /><p className="text-[10px] text-muted-foreground">Phone-size preview · 320 × 180</p></div>
      {image && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => exportImage(false)}><Download size={15} /> Download JPEG</Button><Button size="sm" disabled={busy || !canUpload} onClick={() => exportImage(true)}><Upload size={15} /> Use for this event</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()}>Replace image</Button></div>}
    </section>
  );
}
