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
        "w-full overflow-hidden rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm",
        className,
      )}
    >
      <div className="overflow-auto flex-1 h-full min-h-0">
        <table className="w-full text-left text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "h-10 px-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest select-none border-b border-border/40",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {data.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick && onRowClick(item)}
                className={cn(
                  "group transition-colors hover:bg-secondary/30",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((col, i) => (
                  <td
                    key={i}
                    className={cn(
                      "p-3 align-middle border-b border-border/10",
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
