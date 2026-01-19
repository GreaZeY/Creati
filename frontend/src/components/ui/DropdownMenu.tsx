import React, { useState, useRef, useEffect } from 'react';
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
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn("relative inline-block", className)} ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {trigger}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                            "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-[1.25rem] border border-white/10 bg-card/60 backdrop-blur-2xl p-2 shadow-2xl ring-1 ring-black/5",
                            align === 'right' ? "right-0" : "left-0"
                        )}
                    >
                        <div className="flex flex-col gap-1" onClick={() => setIsOpen(false)}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 outline-none",
                variant === 'default'
                    ? "text-muted-foreground hover:bg-white/5 hover:text-white"
                    : "text-red-400 hover:bg-red-500/10 hover:text-red-300",
                className
            )}
        >
            {children}
        </button>
    );
};
