import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && onEndReached) {
          onEndReached();
        }
      },
      { threshold: 0.5 },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [onEndReached]);

  if (isLoading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
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
        "w-full overflow-hidden rounded-[32px] glass-panel shadow-glass",
        className,
      )}
    >
      <div className="overflow-auto flex-1 h-full min-h-0">
        <table className="premium-table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "h-14 px-8 text-xs font-bold uppercase text-slate-500 dark:text-muted-foreground/60 tracking-widest select-none border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick && onRowClick(item)}
                className={cn(
                  "hover:bg-white dark:hover:bg-white/[0.02] transition-all duration-300 group hover:shadow-sm dark:hover:shadow-none",
                  onRowClick && "cursor-pointer",
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
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                        ? (item[col.accessorKey] as ReactNode)
                        : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Infinite Scroll Trigger */}
        <div ref={observerTarget} className="h-4 w-full" />
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center p-4 border-t border-border/20">
          <Loader2 className="animate-spin text-primary/50" size={16} />
        </div>
      )}
    </div>
  );
}
