import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface Column<T> {
  header: ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  onEndReached?: () => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  onRowClick,
  isLoading,
  isFetchingNextPage,
  onEndReached,
  emptyMessage = "No data found",
  className,
}: DataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length + (isFetchingNextPage ? 3 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Default row height
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end || 0)
      : 0;

  // Infinite Scroll Trigger
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= data.length - 1 &&
      onEndReached &&
      !isFetchingNextPage &&
      !isLoading
    ) {
      onEndReached();
    }
  }, [virtualItems, data.length, onEndReached, isFetchingNextPage, isLoading]);

  if (isLoading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 border rounded-xl border-dashed border-border/50 bg-secondary/10">
        <Loader2 className="animate-spin mb-2" size={24} />
        <p className="text-xs uppercase tracking-widest font-bold">
          Loading Vault...
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 border rounded-xl border-dashed border-border/50 bg-secondary/10">
        <p className="text-xs uppercase tracking-widest font-bold">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md glass-panel shadow-glass flex flex-col h-full min-h-0",
        className,
      )}
    >
      <div
        ref={parentRef}
        className="overflow-auto flex-1 h-full min-h-0 scrollbar-subtle"
      >
        <table className="premium-table w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-black/95 backdrop-blur-md">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "h-14 px-8 text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground/60 tracking-[0.2em] select-none border-b border-slate-200 dark:border-white/5",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr style={{ height: `${paddingTop}px` }}>
                <td colSpan={columns.length} style={{ padding: 0 }} />
              </tr>
            )}
            {virtualItems.map((vRow) => {
              const isLoaderRow = vRow.index >= data.length;
              const item = data[vRow.index];

              return (
                <tr
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  onClick={() => !isLoaderRow && onRowClick && onRowClick(item)}
                  className={cn(
                    "transition-all duration-300 group hover:shadow-sm dark:hover:shadow-none",
                    !isLoaderRow && "hover:bg-white dark:hover:bg-white/[0.02]",
                    !isLoaderRow && onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-8 py-5 align-middle border-b border-slate-200/50 dark:border-white/5",
                        col.className,
                      )}
                    >
                      {isLoaderRow ? (
                        <div className="h-4 w-full bg-muted/20 animate-pulse rounded-full" />
                      ) : col.cell ? (
                        col.cell(item)
                      ) : col.accessorKey ? (
                        (item[col.accessorKey] as ReactNode)
                      ) : null}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr style={{ height: `${paddingBottom}px` }}>
                <td colSpan={columns.length} style={{ padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
