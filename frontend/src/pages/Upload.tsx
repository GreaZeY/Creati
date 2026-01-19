import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { uploadAPI } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud, FileVideo, X, Sparkles } from 'lucide-react';
import { PLATFORMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import axios from 'axios';

export const Upload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['youtube']);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
            setSuccess(false);
            if (title === '') setTitle(acceptedFiles[0].name.replace(/\.[^/.]+$/, ""));
        }
    }, [title]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/mp4': ['.mp4'],
            'video/quicktime': ['.mov'],
            'video/x-msvideo': ['.avi']
        },
        maxFiles: 1,
        maxSize: 2 * 1024 * 1024 * 1024,
    });

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);

        try {
            const { data } = await uploadAPI.init({
                filename: file.name,
                contentType: file.type,
                size: file.size
            });

            await axios.put(data.uploadUrl, file, {
                headers: { 'Content-Type': file.type },
            });

            await uploadAPI.confirm({
                key: data.key,
                title: title || file.name,
                description: description,
                platforms: selectedPlatforms
            });

            setSuccess(true);
            setTimeout(() => {
                setFile(null);
                setTitle('');
                setDescription('');
                setSuccess(false);
            }, 3000);
        } catch (err: any) {
            setError("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-8">
            <header className="space-y-3 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-inner">
                        <UploadCloud className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">Upload Content</h2>
                </div>
                <p className="text-muted-foreground text-lg font-medium">Upload once, publish everywhere across your network.</p>
            </header>

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
                                    "rounded-[3rem] bg-card/40 backdrop-blur-xl border-2 border-dashed flex flex-col items-center justify-center p-24 text-center cursor-pointer transition-all duration-500 relative overflow-hidden group shadow-2xl ring-1 ring-white/10",
                                    isDragActive ? "border-primary bg-primary/[0.05] ring-4 ring-primary/20 scale-[1.02]" : "border-white/10 hover:border-primary/50 hover:bg-card/60 hover:shadow-primary/5"
                                )}
                            >
                                <input {...getInputProps()} />

                                {/* Decorative elements */}
                                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />

                                <div className={cn(
                                    "w-28 h-28 rounded-[2.5rem] flex items-center justify-center mb-8 transition-all duration-700 relative z-10 shadow-2xl ring-1 ring-white/10",
                                    isDragActive ? "bg-primary text-white rotate-12 scale-110 shadow-primary/30" : "bg-secondary/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:rotate-3"
                                )}>
                                    <UploadCloud className="w-12 h-12" />
                                </div>
                                <h3 className="text-3xl font-black mb-4 tracking-tight relative z-10">Drop your masterpiece here</h3>
                                <p className="text-muted-foreground mb-12 max-w-sm text-lg font-medium leading-relaxed relative z-10">
                                    MP4, MOV, or AVI up to 2GB. We'll handle the rest.
                                </p>
                                <Button size="lg" className="rounded-2xl h-16 px-12 shadow-2xl shadow-primary/30 font-black text-lg bg-gradient-to-r from-primary to-cyan-500 hover:scale-105 active:scale-95 transition-all relative z-10">
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
                            <div className="lg:col-span-2 space-y-8">
                                <Card className="p-10 space-y-8 border-0 bg-card/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl ring-1 ring-white/10 relative overflow-hidden">
                                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px]" />

                                    <div className="space-y-6 relative z-10">
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
                                                className="w-full h-14 px-6 rounded-2xl bg-secondary/30 border-white/10 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-black text-lg placeholder:text-muted-foreground/30 ring-1 ring-white/5"
                                            />
                                        </div>
                                        <div className="space-y-2.5">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Description</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Tell your audience about this video..."
                                                rows={6}
                                                className="w-full p-6 rounded-2xl bg-secondary/30 border-white/10 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none font-medium leading-relaxed placeholder:text-muted-foreground/30 ring-1 ring-white/5"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6 relative z-10">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Target Platforms</label>
                                        <div className="flex flex-wrap gap-3">
                                            {Object.values(PLATFORMS).map((p) => {
                                                const isSelected = selectedPlatforms.includes(p.id);
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPlatforms(prev =>
                                                                isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                                            );
                                                        }}
                                                        disabled={!p.enabled || uploading || success}
                                                        className={cn(
                                                            "flex items-center gap-3 px-6 py-3 rounded-2xl border-0 transition-all font-black text-sm uppercase tracking-wider ring-1 shadow-lg",
                                                            isSelected
                                                                ? "bg-gradient-to-r from-primary to-cyan-500 text-white ring-primary shadow-primary/20 scale-105"
                                                                : "bg-secondary/50 text-muted-foreground/60 ring-white/10 hover:bg-secondary hover:text-muted-foreground hover:scale-105",
                                                            !p.enabled && "opacity-20 cursor-not-allowed grayscale scale-100 ring-transparent"
                                                        )}
                                                    >
                                                        {p.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="space-y-8">
                                <Card className="p-8 border-0 bg-card/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl ring-1 ring-white/10 relative overflow-hidden group">
                                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />

                                    <div className="flex items-center justify-between mb-8 relative z-10">
                                        <div className="p-4 rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-inner group-hover:rotate-6 transition-transform">
                                            <FileVideo size={24} />
                                        </div>
                                        <button
                                            onClick={() => setFile(null)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-2 mb-10 relative z-10">
                                        <h4 className="font-black text-xl tracking-tight truncate group-hover:text-primary transition-colors" title={file.name}>{file.name}</h4>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-destructive/10 text-destructive rounded-xl text-xs font-black uppercase tracking-widest ring-1 ring-destructive/20 mb-6"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    <Button
                                        className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl shadow-primary/30 relative overflow-hidden group-hover:scale-105 active:scale-95 transition-all bg-gradient-to-r from-primary to-cyan-500"
                                        onClick={handleUpload}
                                        isLoading={uploading}
                                        isSuccess={success}
                                        loadingText="Syncing..."
                                        successText="Masterpiece Live!"
                                    >
                                        <span className="relative z-10">Publish Content</span>
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                                    </Button>
                                </Card>

                                <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 backdrop-blur-md relative overflow-hidden group hover:bg-primary/10 transition-colors">
                                    <div className="flex gap-4 relative z-10">
                                        <Sparkles className="w-5 h-5 text-primary shrink-0 animate-pulse" />
                                        <p className="text-xs text-primary/80 leading-relaxed font-black uppercase tracking-widest">
                                            Pro Tip: Customizing descriptions for each platform can improve your reach!
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
