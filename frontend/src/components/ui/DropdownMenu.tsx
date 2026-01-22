import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}

export const DropdownMenu = ({ trigger, children, align = 'right', className }: DropdownMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
                menuRef.current && !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const menuWidth = 176; // min-w-[11rem] = 176px
            setPosition({
                top: rect.bottom + window.scrollY + 4, // 4px gap below trigger
                left: align === 'right'
                    ? rect.right - menuWidth + window.scrollX
                    : rect.left + window.scrollX,
            });
        }
    }, [isOpen, align]);

    return (
        <div className={cn("relative inline-block", className)} ref={triggerRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {trigger}
            </div>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                            style={{
                                position: 'fixed',
                                top: position.top,
                                left: position.left,
                                transformOrigin: 'top right'
                            }}
                            className="z-[9999] min-w-[11rem] overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-2xl p-1.5 shadow-2xl"
                        >
                            <div className="flex flex-col gap-0.5" onClick={() => setIsOpen(false)}>
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

interface DropdownItemProps {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    variant?: 'default' | 'danger';
}

export const DropdownItem = ({ children, onClick, className, variant = 'default' }: DropdownItemProps) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 outline-none",
                variant === 'default'
                    ? "text-muted-foreground hover:bg-white/5 hover:text-slate-950"
                    : "text-red-400 hover:bg-red-500/10 hover:text-red-300",
                className
            )}
        >
            {children}
        </button>
    );
};
