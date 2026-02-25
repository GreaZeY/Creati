import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { toast } from "@/lib/events";
import { LensedCard } from "@/components/ui/LensedCard";

interface DropContext {
  clientName: string;
  logoUrl: string;
  color: string;
}

export const AssetDrop = () => {
  const { token } = useParams<{ token: string }>();
  const [context, setContext] = useState<DropContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await api.get(`/drop/${token}`);
        if (res.data.success) {
          setContext(res.data.data);
        } else {
          setError(res.data.error || "Failed to load drop portal");
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            "This drop link appears to be invalid or expired.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchContext();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith("video/")) {
        toast.error("Please upload a valid video file.");
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async () => {
    if (!file || !token) return;

    setUploading(true);
    setProgress(0);

    try {
      // 1. Init Upload
      const initRes = await api.post(`/drop/${token}/init`, {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      if (!initRes.data.success) throw new Error(initRes.data.error);
      const { uploadUrl, key } = initRes.data.data;

      // 2. Upload to S3
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () =>
          xhr.status === 200
            ? resolve(null)
            : reject(new Error("Upload failed"));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      // 3. Confirm
      const confirmRes = await api.post(`/drop/${token}/confirm`, {
        key,
        title: file.name,
        size: file.size,
      });

      if (confirmRes.data.success) {
        setSuccess(true);
        toast.success("Asset dropped successfully!");
      } else {
        throw new Error(confirmRes.data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <LensedCard className="max-w-md w-full p-8 text-center bg-white/5 border-white/10">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Retry
          </Button>
        </LensedCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="max-w-4xl mx-auto px-6 py-12 lg:py-24">
        {/* White-Label Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-12"
        >
          {context?.logoUrl ? (
            <img
              src={context.logoUrl}
              alt={context.clientName}
              className="h-12 w-auto mb-6 object-contain"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
              <Upload className="w-6 h-6 text-primary" />
            </div>
          )}
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-center">
            {context?.clientName} Assets Portal
          </h1>
          <p className="text-muted-foreground mt-2 text-center max-w-lg">
            Drop your raw footage here. We'll handle the editing and
            distribution from here.
          </p>
        </motion.div>

        <LensedCard className="p-1 min-h-[400px] flex items-center justify-center relative overflow-hidden bg-white/5 border-white/10 lg:rounded-[2rem]">
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
              >
                {!uploading ? (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group cursor-pointer hover:border-primary/50 transition-all duration-500 relative overflow-hidden shadow-2xl">
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Upload className="w-8 h-8 text-white/50 group-hover:text-primary group-hover:scale-110 transition-all duration-500" />
                      <input
                        type="file"
                        accept="video/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                      />
                    </div>

                    {file ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
                          <FileVideo className="w-4 h-4 text-primary" />
                          <span className="font-medium truncate max-w-[200px]">
                            {file.name}
                          </span>
                          <span className="text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(1)}MB)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            className="h-12 px-8 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                            onClick={handleUpload}
                          >
                            Upload Asset
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-12 px-8 rounded-2xl"
                            onClick={() => setFile(null)}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold">
                          Select raw footage
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Select a file from your device
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full max-w-sm space-y-8">
                    <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="absolute inset-0 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                      />
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      <span className="text-4xl font-black tracking-tighter">
                        {progress}%
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground animate-pulse">
                        Uploading Heavy Asset...
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center p-12 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Drop Successful!</h2>
                <p className="text-muted-foreground max-w-xs mb-8">
                  Your asset has been received. We'll start processing it
                  immediately.
                </p>
                <Button
                  variant="outline"
                  className="rounded-2xl h-11 px-8"
                  onClick={() => {
                    setSuccess(false);
                    setFile(null);
                    setProgress(0);
                  }}
                >
                  Drop another asset
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </LensedCard>

        {/* Security Footer */}
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-bold">
          <ShieldCheck className="w-3 h-3" />
          Secure Encrypted Transfer
        </div>
      </div>
    </div>
  );
};
