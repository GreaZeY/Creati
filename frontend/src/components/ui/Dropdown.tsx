import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popper } from "./Popper";
import { Button } from "./Button";
import { TextTruncate } from "./Truncate";

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
  const [searchQuery, setSearchQuery] = useState("");
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
    setSearchQuery(""); // Reset search on select

    // Save to localStorage if persistent
    if (persistent) {
      localStorage.setItem(storageKey, JSON.stringify(item.id));
    }

    // Call onChange callback
    onChange?.(item);
  };

  const defaultTrigger = (
    item: DropdownItem<T> | null,
    _: boolean,
    toggle: () => void,
  ) => (
    <button
      onClick={toggle}
      className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-background hover:bg-muted border border-border/50 transition-all group"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {item?.icon && (
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
        )}
        <TextTruncate
          text={item?.label || placeholder}
          className="text-xs font-bold tracking-tight"
        />
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
      <TextTruncate text={item.label} className="flex-1" disableInteractivity />
      {isSelected && <Check size={14} className="text-primary" />}
    </>
  );

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery(""); // Reset search when closing
    }
  };

  // Filter items based on search query
  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : items;

  const showSearch = items.length > 5;

  const sizeClasses = {
    sm: "w-[160px]",
    md: "w-[240px]",
    lg: "w-[320px]",
  };

  const heightClasses = {
    sm: "max-h-[180px]",
    md: "max-h-[240px]",
    lg: "max-h-[320px]",
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
              style={{
                width: triggerRef.current?.offsetWidth || 240,
                maxWidth: "min(320px, 90vw)",
              }}
              className="bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden"
            >
              {showSearch && (
                <div className="p-2 border-b border-border/30">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-background border border-border/30 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "overflow-y-auto",
                  heightClasses[size],
                  showSearch ? "py-1" : "py-1",
                )}
              >
                {filteredItems.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      {searchQuery ? "No matches found" : emptyMessage}
                    </p>
                  </div>
                )}
                {filteredItems.map((item) => {
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
                <div className="p-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      footerAction.onClick();
                      setIsOpen(false);
                    }}
                    className="w-full"
                  >
                    {footerAction.icon}
                    {footerAction.label}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Popper>
    </>
  );
}
