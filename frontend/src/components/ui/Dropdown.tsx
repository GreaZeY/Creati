import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popper } from "./Popper";

export interface DropdownItem<T = any> {
  id: string | number;
  label: string;
  value: T;
  icon?: ReactNode;
}

export interface DropdownProps<T = any> {
  id: string;
  items: DropdownItem<T>[];
  value?: T;
  onChange?: (item: DropdownItem<T>) => void;
  placeholder?: string;
  emptyMessage?: string;
  persistent?: boolean;
  size?: "sm" | "md" | "lg";
  renderTrigger?: (
    item: DropdownItem<T> | null,
    isOpen: boolean,
    toggle: () => void,
  ) => ReactNode;
  renderItem?: (item: DropdownItem<T>, isSelected: boolean) => ReactNode;
  footerAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  className?: string;
}

export function Dropdown<T = any>({
  id,
  items,
  value,
  onChange,
  placeholder = "Select an item",
  emptyMessage = "No items found",
  persistent = false,
  size = "md",
  renderTrigger,
  renderItem,
  footerAction,
  className,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DropdownItem<T> | null>(
    null,
  );
  const triggerRef = useRef<HTMLDivElement>(null);

  const storageKey = `dropdown_${id}_selected`;

  // Load from localStorage on mount if persistent
  useEffect(() => {
    if (persistent) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const savedId = JSON.parse(saved);
          const found = items.find((item) => item.id === savedId);
          if (found) {
            setSelectedItem(found);
          }
        } catch (e) {
          console.warn("Failed to parse saved dropdown value", e);
        }
      }
    }
  }, [persistent, storageKey, items]);

  // Sync with external value prop
  useEffect(() => {
    if (value !== undefined) {
      const found = items.find((item) => item.value === value);
      setSelectedItem(found || null);
    }
  }, [value, items]);

  const handleSelect = (item: DropdownItem<T>) => {
    setSelectedItem(item);
    setIsOpen(false);

    // Save to localStorage if persistent
    if (persistent) {
      localStorage.setItem(storageKey, JSON.stringify(item.id));
    }

    // Call onChange callback
    onChange?.(item);
  };

  const defaultTrigger = (
    item: DropdownItem<T> | null,
    isOpen: boolean,
    toggle: () => void,
  ) => (
    <button
      onClick={toggle}
      className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-muted/50 hover:bg-muted border border-border transition-all group"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {item?.icon && (
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
        )}
        <span className="text-xs font-bold tracking-tight truncate">
          {item?.label || placeholder}
        </span>
      </div>
      <ChevronsUpDown
        size={14}
        className="opacity-40 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );

  const defaultItemRender = (item: DropdownItem<T>, isSelected: boolean) => (
    <>
      {item.icon && (
        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
          {item.icon}
        </div>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {isSelected && <Check size={14} className="text-primary" />}
    </>
  );

  const toggleDropdown = () => setIsOpen(!isOpen);

  const sizeClasses = {
    sm: "min-w-[160px] max-w-[240px]",
    md: "min-w-[240px] max-w-[320px]",
    lg: "min-w-[320px] max-w-[400px]",
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("relative w-full", sizeClasses[size], className)}
      >
        {renderTrigger
          ? renderTrigger(selectedItem, isOpen, toggleDropdown)
          : defaultTrigger(selectedItem, isOpen, toggleDropdown)}
      </div>

      <Popper
        anchorEl={triggerRef.current}
        open={isOpen}
        onClickAway={() => setIsOpen(false)}
        placement="bottom-start"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              style={{ minWidth: triggerRef.current?.offsetWidth || 240 }}
              className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden py-1"
            >
              <div className="max-h-[240px] overflow-y-auto">
                {items.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      {emptyMessage}
                    </p>
                  </div>
                )}
                {items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 text-xs font-medium text-left transition-colors"
                    >
                      {renderItem
                        ? renderItem(item, isSelected)
                        : defaultItemRender(item, isSelected)}
                    </button>
                  );
                })}
              </div>

              {footerAction && (
                <div className="p-2 border-t border-border">
                  <button
                    onClick={() => {
                      footerAction.onClick();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black tracking-widest uppercase hover:bg-primary/20 transition-all"
                  >
                    {footerAction.icon}
                    {footerAction.label}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Popper>
    </>
  );
}
