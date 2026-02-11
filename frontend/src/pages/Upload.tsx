import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { uploadAPI, platformsAPI } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud,
  FileVideo,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClient } from "@/context/ClientContext";

interface ConnectedAccount {
  accountId: number;
  id: string;
  name: string;
  platform: string;
  connected: boolean;
  profileName: string;
  platformUserId: string;
  handle?: string;
}

export const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedClient } = useClient();

  // Fetch connected accounts
  // Fetch connected accounts with a specific key to avoid conflicts
  const { data: connectedAccounts = [] } = useQuery({
    queryKey: ["connected-accounts", selectedClient?.id],
    queryFn: async () => {
      const resp = await platformsAPI.list(selectedClient?.id);
      const allAccounts = (resp.data.data || []) as ConnectedAccount[];
      return allAccounts.filter((a) => a.connected);
    },
  });

  // Auto-select first account when accounts load if none selected
  useEffect(() => {
    if (selectedAccounts.length === 0 && connectedAccounts.length > 0) {
      setSelectedAccounts([connectedAccounts[0].accountId]);
    }
  }, [connectedAccounts, selectedAccounts.length]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles?.length > 0) {
        setFile(acceptedFiles[0]);
        setError(null);
        setSuccess(false);
        if (title === "")
          setTitle(acceptedFiles[0].name.replace(/\.[^/.]+$/, ""));
      }
    },
    [title],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/x-msvideo": [".avi"],
    },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file) return;
    if (selectedAccounts.length === 0) {
      setError("Please select at least one account to publish to.");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const resp = await uploadAPI.init({
        filename: file.name,
        size: file.size,
        contentTitle: title || file.name,
      });

      // Access nested data from SuccessResponse
      const { uploadUrl, key } = resp.data.data;

      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      await uploadAPI.confirm({
        key: key,
        title: title || file.name,
        description: description,
        accountIds: selectedAccounts,
        clientId: selectedClient?.id,
      });

      setSuccess(true);
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setDescription("");
        setSelectedAccounts([]);
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-8">
      <PageHeader
        title="Upload"
        description="Upload once, publish everywhere across your network."
      />

      <div className="relative">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <div
                {...getRootProps()}
                className={cn(
                  "rounded-2xl bg-white/40 dark:bg-card/40 backdrop-blur-xl border-2 border-dashed flex flex-col items-center justify-center p-10 text-center cursor-pointer transition-all duration-500 relative overflow-hidden group shadow-lg ring-1 ring-border",
                  isDragActive
                    ? "border-primary bg-primary/[0.05] ring-4 ring-primary/20 scale-[1.02]"
                    : "border-border hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-card/60 hover:shadow-primary/5",
                )}
              >
                <input {...getInputProps()} />

                {/* Decorative elements */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />

                <div
                  className={cn(
                    "w-14 h-14 rounded-lg flex items-center justify-center mb-5 transition-all duration-700 relative z-10 shadow-lg ring-1 ring-border",
                    isDragActive
                      ? "bg-primary text-slate-950 rotate-12 scale-110 shadow-primary/30"
                      : "bg-secondary/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:rotate-3",
                  )}
                >
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold mb-2 tracking-tight relative z-10">
                  Drop your masterpiece here
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-xs font-medium leading-relaxed relative z-10">
                  MP4, MOV, or AVI up to 2GB. We'll handle the rest.
                </p>
                <Button className="rounded-lg h-9 px-6 shadow-lg shadow-primary/30 font-bold text-sm bg-gradient-to-r from-primary to-cyan-500 hover:scale-105 active:scale-95 transition-all relative z-10">
                  Browse Files
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-4 space-y-5 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-border relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px]" />

                  <div className="space-y-5 relative z-10">
                    <div className="space-y-2.5">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        Video Title
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Catchy title for your video"
                        className="w-full h-9 px-3 rounded-lg bg-secondary/30 dark:bg-muted/30 border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-xs placeholder:text-muted-foreground/30 ring-1 ring-border/50"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell your audience about this video..."
                        rows={5}
                        className="w-full p-4 rounded-xl bg-secondary/30 dark:bg-muted/30 border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none font-medium leading-relaxed placeholder:text-muted-foreground/30 ring-1 ring-border/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-5 relative z-10">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                      Target Accounts
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {connectedAccounts.length > 0 ? (
                        connectedAccounts.map((account) => {
                          const isSelected = selectedAccounts.includes(
                            account.accountId,
                          );
                          return (
                            <button
                              key={account.accountId}
                              type="button"
                              onClick={() => {
                                setSelectedAccounts((prev) =>
                                  isSelected
                                    ? prev.filter(
                                        (id) => id !== account.accountId,
                                      )
                                    : [...prev, account.accountId],
                                );
                              }}
                              disabled={uploading || success}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg border-0 transition-all font-black text-xs uppercase tracking-wider ring-1 shadow-md",
                                isSelected
                                  ? "bg-gradient-to-r from-primary to-cyan-500 text-primary-foreground ring-primary shadow-primary/20 scale-105"
                                  : "bg-secondary/50 dark:bg-muted/50 text-muted-foreground/60 ring-border hover:bg-secondary hover:text-muted-foreground hover:scale-105",
                              )}
                            >
                              <PlatformLogo
                                platform={account.platform}
                                size={16}
                                className={cn(
                                  "transition-colors",
                                  isSelected
                                    ? "text-primary-foreground"
                                    : "text-muted-foreground/60",
                                )}
                              />
                              <div className="flex flex-col items-start leading-tight">
                                <span className="text-[10px] opacity-70 font-bold">
                                  {account.platform}
                                </span>
                                <span className="truncate max-w-[120px]">
                                  {account.profileName || "Connected"}
                                </span>
                                {account.handle && (
                                  <span className="text-[9px] opacity-50 font-medium truncate max-w-[120px]">
                                    {account.handle}
                                  </span>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 ml-1" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-muted-foreground text-sm font-medium p-4 bg-muted/30 rounded-2xl w-full border border-dashed border-border text-center">
                          No accounts connected.{" "}
                          <a
                            href="/platforms/connect"
                            className="text-primary hover:underline"
                          >
                            Connect one now
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-4 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-border relative overflow-hidden group">
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />

                  <div className="flex items-center justify-between mb-5 relative z-10">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shadow-inner group-hover:rotate-6 transition-transform">
                      <FileVideo size={18} />
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-1 mb-6 relative z-10">
                    <h4
                      className="font-bold text-base tracking-tight truncate group-hover:text-primary transition-colors text-foreground dark:text-white"
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-destructive/10 text-destructive rounded-lg text-[10px] font-black uppercase tracking-widest ring-1 ring-destructive/20 mb-5"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button
                    className="w-full h-10 rounded-lg font-bold text-sm shadow-lg shadow-primary/30 relative overflow-hidden group-hover:scale-105 active:scale-95 transition-all bg-gradient-to-r from-primary to-cyan-500"
                    onClick={handleUpload}
                    isLoading={uploading}
                    isSuccess={success}
                    loadingText="Syncing..."
                    successText="Masterpiece Live!"
                  >
                    <span className="relative z-10">Publish Content</span>
                    <div className="absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                  </Button>
                </Card>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 backdrop-blur-md relative overflow-hidden group hover:bg-primary/10 transition-colors">
                  <div className="flex gap-3 relative z-10">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                    <p className="text-[10px] text-primary/80 leading-relaxed font-black uppercase tracking-widest">
                      Pro Tip: Customizing descriptions for each platform can
                      improve your reach!
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
