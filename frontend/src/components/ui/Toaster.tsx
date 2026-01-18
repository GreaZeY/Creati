import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toastEvents, type ToastEvent } from '@/lib/events';

const TOAST_DURATION = 5000;

export const Toaster = () => {
    const [toasts, setToasts] = useState<ToastEvent[]>([]);

    useEffect(() => {
        const unsubscribe = toastEvents.subscribe((event) => {
            setToasts((prev) => {
                const newToasts = [...prev, event];
                if (newToasts.length > 5) {
                    return newToasts.slice(newToasts.length - 5);
                }
                return newToasts;
            });

            // Auto dismiss
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== event.id));
            }, TOAST_DURATION);
        });

        return unsubscribe;
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none items-end">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`
                            pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl shadow-lg border backdrop-blur-md flex items-start gap-3
                            ${t.type === 'error' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                                t.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                    'bg-card/80 border-border text-foreground'}
                        `}
                    >
                        <div className="mt-0.5">
                            {t.type === 'error' && <AlertCircle className="w-5 h-5" />}
                            {t.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                            {t.type === 'info' && <Info className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm leading-relaxed">{t.message}</p>
                        </div>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="hover:opacity-70 transition-opacity"
                        >
                            <X className="w-4 h-4 opacity-50" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>,
        document.body
    );
};
