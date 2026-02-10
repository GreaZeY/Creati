import React from "react";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";
import { DropdownMenu, DropdownItem } from "./DropdownMenu";
import { ChevronDown, Check } from "lucide-react";

export interface Tag {
  id: string;
  label: string;
  icon?: React.ReactNode;
  [key: string]: any;
}

interface ChipSelectorProps {
  tags: Tag[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  selection?: "single" | "multi";
  maxVisibleCount?: number;
  className?: string;
  chipClassName?: string;
}

export function ChipSelector({
  tags,
  selectedIds,
  onSelect,
  selection = "single",
  maxVisibleCount = 5,
  className,
  chipClassName,
}: ChipSelectorProps) {
  const visibleTags = tags.slice(0, maxVisibleCount);
  const hiddenTags = tags.slice(maxVisibleCount);

  const handleSelect = (id: string) => {
    onSelect(id);
  };

  const isMulti = selection === "multi";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Visible Chips */}
      {visibleTags.map((tag) => (
        <Chip
          key={tag.id}
          label={tag.label}
          icon={tag.icon}
          isSelected={selectedIds.includes(tag.id)}
          onClick={() => handleSelect(tag.id)}
          className={chipClassName}
        />
      ))}

      {/* Overflow Dropdown */}
      {hiddenTags.length > 0 && (
        <DropdownMenu
          trigger={
            <button
              type="button"
              className={cn(
                "h-8 px-2 rounded-full border border-border/40 bg-background/50",
                "text-muted-foreground hover:border-primary/40 hover:text-foreground",
                "flex items-center gap-1 transition-all duration-200",
              )}
            >
              <span className="text-[10px] font-bold px-1">
                +{hiddenTags.length}
              </span>
              <ChevronDown size={14} />
            </button>
          }
          align="left"
        >
          <div className="max-h-[300px] overflow-y-auto py-1">
            {hiddenTags.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <DropdownItem
                  key={tag.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(tag.id);
                  }}
                  className={cn(
                    "justify-between",
                    isSelected && "bg-primary/5 text-primary",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {tag.icon && (
                      <span className="flex-shrink-0 text-foreground">
                        {tag.icon}
                      </span>
                    )}
                    <span className="truncate">{tag.label}</span>
                  </div>
                  {isSelected &&
                    (isMulti ? (
                      <Check size={14} className="stroke-[3]" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ))}
                </DropdownItem>
              );
            })}
          </div>
        </DropdownMenu>
      )}
    </div>
  );
}
