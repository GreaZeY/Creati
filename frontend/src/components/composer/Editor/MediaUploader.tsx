import { useRef, useState } from "react";
import {
  Upload,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: "image" | "video";
  uploading?: boolean;
  error?: string;
}

interface MediaUploaderProps {
  media: MediaFile[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxFiles?: number;
}

export function MediaUploader({
  media,
  onAdd,
  onRemove,
  maxFiles = 10,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const maxSize = 100 * 1024 * 1024; // 100MB

    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        alert(`${file.name} is too large. Max size is 100MB.`);
        return;
      }

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (isImage || isVideo) {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      onAdd(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const canAddMore = media.length < maxFiles;

  return (
    <div className="space-y-3">
      {/* Uploaded Media Grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group aspect-video rounded-lg overflow-hidden border border-border/40 bg-card"
            >
              {item.type === "image" ? (
                <img
                  src={item.preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.preview}
                  className="w-full h-full object-cover"
                  muted
                />
              )}

              {/* Loading overlay */}
              {item.uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-xs font-bold text-white">
                    Uploading...
                  </div>
                </div>
              )}

              {/* Error overlay */}
              {item.error && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center p-2">
                  <div className="text-[10px] font-bold text-red-400 text-center">
                    {item.error}
                  </div>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => onRemove(item.id)}
                className={cn(
                  "absolute top-1 right-1 h-6 w-6 rounded-full",
                  "bg-black/80 hover:bg-black text-white",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                )}
              >
                <X size={14} />
              </button>

              {/* Type indicator */}
              <div className="absolute bottom-1 left-1 h-5 px-1.5 rounded bg-black/60 flex items-center gap-1">
                {item.type === "image" ? (
                  <ImageIcon size={10} className="text-white" />
                ) : (
                  <VideoIcon size={10} className="text-white" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/40 hover:border-primary/40 hover:bg-accent/5",
          )}
        >
          <div className="text-center">
            <Upload
              size={24}
              className={cn(
                "mx-auto mb-2 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground/40",
              )}
            />
            <p className="text-xs font-bold text-muted-foreground">
              Drop files or click to upload
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Images & videos (max 100MB)
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
    </div>
  );
}
