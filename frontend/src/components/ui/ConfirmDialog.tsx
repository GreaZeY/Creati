import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './Button';
import { useEffect } from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}: ConfirmDialogProps) => {
    // Prevent scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const colors = {
        danger: 'from-red-500 to-rose-600 shadow-red-500/20',
        warning: 'from-amber-500 to-orange-600 shadow-amber-500/20',
        info: 'from-blue-500 to-cyan-600 shadow-blue-500/20'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={!isLoading ? onClose : undefined}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25
                        }}
                        className="relative w-full max-w-md bg-card/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
                    >
                        {/* Status Bar */}
                        <div className={`h-1.5 w-full bg-gradient-to-r ${colors[variant]}`} />

                        <div className="p-8 sm:p-10">
                            {/* Icon */}
                            <div className="flex justify-center mb-8">
                                <div className={`p-5 rounded-[1.5rem] bg-gradient-to-br ${colors[variant]} bg-opacity-10 ring-1 ring-white/20`}>
                                    <AlertCircle className="w-10 h-10 text-white" />
                                </div>
                            </div>

                            {/* Text */}
                            <div className="text-center space-y-4 mb-10">
                                <h3 className="text-2xl font-black tracking-tight text-white">{title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {description}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 h-14 rounded-[1.25rem] border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white transition-all duration-300"
                                >
                                    {cancelText}
                                </Button>
                                <Button
                                    onClick={onConfirm}
                                    isLoading={isLoading}
                                    className={`flex-1 h-14 rounded-[1.25rem] bg-gradient-to-r ${colors[variant]} border-0 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-bold text-white shadow-lg`}
                                >
                                    {confirmText}
                                </Button>
                            </div>
                        </div>

                        {/* Top Right Close Button */}
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
