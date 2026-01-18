import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { uploadAPI } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud, FileVideo, X, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const Upload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
            setSuccess(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/mp4': ['.mp4'],
            'video/quicktime': ['.mov'],
            'video/x-msvideo': ['.avi']
        },
        maxFiles: 1,
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    });

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            // 1. Get Presigned URL
            const { data } = await uploadAPI.init({
                filename: file.name,
                contentType: file.type,
                size: file.size
            });

            // 2. Upload to S3 directly
            await axios.put(data.uploadUrl, file, {
                headers: {
                    'Content-Type': file.type
                },
            });

            // 3. Confirm (Optional)
            // await uploadAPI.confirm(data.key);

            setSuccess(true);
            setTimeout(() => {
                setFile(null);
                setSuccess(false);
            }, 3000);

        } catch (err: any) {
            console.error(err);
            setError("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Upload Content</h1>
                <p className="text-muted-foreground">Upload once, publish everywhere.</p>
            </div>

            <div className="max-w-3xl mx-auto">
                <AnimatePresence mode="wait">
                    {!file ? (
                        <motion.div
                            key="dropzone"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {/* Use div for dropzone to avoid Card props conflict, style it manually or use Card without spread if possible.
                                Actually, spreading getRootProps on a custom component can be tricky if it doesn't forward ref or accept all HTML props.
                                I'll use a div with Card classes.
                            */}
                            <div
                                {...getRootProps()}
                                className={`rounded-xl bg-card text-card-foreground shadow-sm p-16 border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300
                                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/20'}
                                `}
                            >
                                <input {...getInputProps()} />
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${isDragActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                    <UploadCloud className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-semibold mb-3">Drag and drop your video</h3>
                                <p className="text-muted-foreground mb-8 max-w-sm text-lg">
                                    Supports MP4, MOV, and AVI up to 2GB.
                                </p>
                                <Button variant="secondary">
                                    Select File
                                </Button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="p-8 border-border bg-card">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                            <FileVideo className="w-8 h-8" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-xl font-semibold">{file.name}</h3>
                                            <p className="text-muted-foreground">
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    {!uploading && !success && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            className="hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                    )}
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        {error}
                                    </div>
                                )}

                                <div className="flex justify-end gap-4">
                                    {!uploading && !success && (
                                        <Button variant="ghost" onClick={() => setFile(null)}>
                                            Cancel
                                        </Button>
                                    )}

                                    <Button
                                        onClick={handleUpload}
                                        isLoading={uploading}
                                        isSuccess={success}
                                        loadingText="Uploading to S3..."
                                        successText="Upload Complete!"
                                        className="w-48"
                                    >
                                        Upload Video
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
};
