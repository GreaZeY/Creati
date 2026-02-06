import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { automationAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/events";
import {
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Terminal,
  Zap,
  Bell,
  Pause,
  Trash2,
} from "lucide-react";
import { TextTruncate } from "@/components/ui/Truncate";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

import { Modal } from "@/components/ui/Modal";

// Simple time ago helper
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Helper for status badge
const StatusBadge = ({
  status,
  progress,
}: {
  status: string;
  progress?: string;
}) => {
  switch (status) {
    case "completed":
    case "success":
    case "sent":
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <CheckCircle2 size={10} /> Success
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
          <AlertTriangle size={10} /> Failed
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
          <AlertTriangle size={10} /> Partial
          {progress && (
            <span className="text-[9px] opacity-70 ml-0.5">({progress})</span>
          )}
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
          <Loader2 size={10} className="animate-spin" /> Processing
          {progress && (
            <span className="text-[9px] opacity-70 ml-0.5">({progress})</span>
          )}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
          <Clock size={10} /> {status}
        </span>
      );
  }
};

export function QueuedJobs() {
  const { selectedClient } = useClient();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["queued-jobs", selectedClient?.id],
      queryFn: async ({ pageParam = 0 }) => {
        const resp = await automationAPI.listJobs(
          20,
          pageParam as number,
          selectedClient?.id,
        );
        return resp.data.data || [];
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === 20 ? allPages.length * 20 : undefined;
      },
    });

  // Flatten data
  const jobs = useMemo(() => {
    return data?.pages.flatMap((page) => page) || [];
  }, [data]);

  // Real-time updates
  useEffect(() => {
    const url = "/api/realtime/blasts";
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === "job_update") {
          // Optimistic update in cache
          queryClient.setQueryData(
            ["queued-jobs", selectedClient?.id],
            (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any[]) =>
                  page.map((job) =>
                    job.id === update.id
                      ? { ...job, status: update.status }
                      : job,
                  ),
                ),
              };
            },
          );

          // Also update selected job if open
          if (selectedJob?.id === update.id) {
            setSelectedJob((prev: any) => ({ ...prev, status: update.status }));
          }
        }
      } catch (err) {
        console.error("SSE error", err);
      }
    };

    return () => eventSource.close();
  }, [queryClient, selectedClient?.id, selectedJob]);

  // Retry Handler
  const handleRetry = async (job: any) => {
    try {
      // Since API uses rule retry or execution retry, we need to distinguish
      if (job.jobType === "sync") {
        await automationAPI.retryExecution(job.id);
      } else {
        await automationAPI.retryRule(job.ruleId);
      }
      toast.success("Retry command sent");
    } catch (error) {
      toast.error("Failed to retry");
    }
  };

  const columns: Column<any>[] = [
    {
      header: "Status",
      accessorKey: "status",
      cell: (job) => (
        <StatusBadge status={job.status} progress={job.progress} />
      ),
      className: "w-[120px]",
    },
    {
      header: "Job",
      cell: (job) => (
        <div className="flex flex-col gap-0.5">
          <TextTruncate
            text={job.ruleName}
            className="font-bold text-xs max-w-[150px]"
          />
          <span className="text-[9px] text-muted-foreground uppercase">
            {job.jobType === "sync" ? "Sync" : "Notify"}
          </span>
        </div>
      ),
    },
    {
      header: "Content",
      cell: (job) => (
        <div className="flex flex-col gap-1 max-w-[200px]">
          {job.contents?.slice(0, 2).map((content: any, i: number) => (
            <div key={i} className="flex flex-col gap-0.5">
              <TextTruncate
                text={content.title}
                className="font-medium text-xs text-foreground"
              />
              <span className="text-[9px] text-muted-foreground truncate opacity-50">
                ID: {content.id}
              </span>
            </div>
          ))}
          {job.contents?.length > 2 && (
            <span className="text-[9px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md self-start">
              +{job.contents.length - 2} more
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Source",
      cell: (job) => {
        const source = job.sources?.[0];
        if (!source) return null;
        return (
          <div className="flex items-center gap-1">
            <PlatformLogo platform={source.platform} size={20} />
            <div>
              <p className="font-bold text-xs">
                {source.handle || source.platform}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Target",
      cell: (job) => {
        const primaryTarget = job.targets?.[0];
        if (!primaryTarget) return null;

        const remainingTargets = job.targets.slice(1);

        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <PlatformLogo platform={primaryTarget.platform} size={20} />
              <div>
                <p className="font-bold text-xs">
                  {primaryTarget.handle || primaryTarget.platform}
                </p>
                {primaryTarget.handle &&
                  primaryTarget.handle !== primaryTarget.platform && (
                    <p className="text-[10px] text-muted-foreground uppercase opacity-60">
                      {primaryTarget.platform}
                    </p>
                  )}
              </div>
            </div>

            {remainingTargets.length > 0 && (
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-5 px-1.5 rounded-full bg-secondary border border-border/50 text-[10px] font-bold text-muted-foreground hover:bg-secondary/80 cursor-default transition-colors">
                      +{remainingTargets.length}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="flex flex-col gap-2 p-1">
                      {remainingTargets.map((t: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 min-w-[120px]"
                        >
                          <PlatformLogo platform={t.platform} size={14} />
                          <span className="text-xs font-medium">
                            {t.handle || t.platform}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
      className: "min-w-[180px]",
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: (job) => (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {timeAgo(job.createdAt)}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (job) => (
        <div className="flex items-center justify-end gap-1">
          {job.status === "failed" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry(job);
              }}
              className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
            >
              <RefreshCcw size={14} />
            </Button>
          )}
          {job.status === "queued" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  await automationAPI.pauseExecution(job.id);
                  toast.success("Job paused");
                }}
                className="h-8 w-8 p-0 text-amber-500 hover:bg-amber-500/10"
              >
                <Pause size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  await automationAPI.cancelExecution(job.id);
                  toast.success("Job cancelled");
                }}
                className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      ),
      className:
        "w-[120px] text-right sticky right-0 bg-background/95 backdrop-blur-sm shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.1)] z-10",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 font-outfit h-full flex flex-col">
      <PageHeader
        title="Mission Control"
        description="Live view of all automated executions and notification events."
      >
        <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Live Uplink Active
          </span>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0">
        <DataTable
          data={jobs}
          columns={columns}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onRowClick={setSelectedJob}
          emptyMessage="No active missions detected."
          className="h-full"
        />
      </div>

      <Drawer
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={
          <div className="flex items-center gap-2">
            <Terminal size={18} />
            <span className="uppercase tracking-widest text-sm font-black">
              Job Details
            </span>
          </div>
        }
      >
        {selectedJob && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm">{selectedJob.ruleName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedJob.jobType === "sync" ? (
                      <Zap size={10} />
                    ) : (
                      <Bell size={10} />
                    )}
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {selectedJob.jobType}
                    </span>
                  </div>
                </div>
                <StatusBadge status={selectedJob.status} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Route
              </h4>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                <div className="flex items-center gap-3">
                  <PlatformLogo
                    platform={selectedJob.sources?.[0]?.platform}
                    size={24}
                  />
                  <div>
                    <p className="font-bold text-xs">
                      {selectedJob.sources?.[0]?.handle ||
                        selectedJob.sources?.[0]?.platform}
                    </p>
                    {selectedJob.sources?.[0]?.handle &&
                      selectedJob.sources?.[0]?.handle !==
                        selectedJob.sources?.[0]?.platform && (
                        <p className="text-[10px] text-muted-foreground uppercase opacity-60">
                          {selectedJob.sources?.[0]?.platform}
                        </p>
                      )}
                  </div>
                </div>
                <ArrowRight size={14} className="text-muted-foreground" />
                <div className="flex flex-col gap-3 w-full">
                  {selectedJob.targets.length === 1 ? (
                    /* Single Target View */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                        {/* Source */}
                        <div className="flex items-center gap-3">
                          <PlatformLogo
                            platform={selectedJob.sources?.[0]?.platform}
                            size={24}
                          />
                          <div>
                            <p className="font-bold text-xs">
                              {selectedJob.sources?.[0]?.handle ||
                                selectedJob.sources?.[0]?.platform}
                            </p>
                            {selectedJob.sources?.[0]?.handle &&
                              selectedJob.sources?.[0]?.handle !==
                                selectedJob.sources?.[0]?.platform && (
                                <p className="text-[10px] text-muted-foreground uppercase opacity-60">
                                  {selectedJob.sources?.[0]?.platform}
                                </p>
                              )}
                          </div>
                        </div>

                        <ArrowRight
                          size={14}
                          className="text-muted-foreground"
                        />

                        {/* Target */}
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="font-bold text-xs">
                              {selectedJob.targets[0].handle ||
                                selectedJob.targets[0].platform}
                            </p>
                            <div className="flex items-center justify-end gap-2">
                              <StatusBadge
                                status={selectedJob.targets[0].status}
                              />
                            </div>
                          </div>
                          <PlatformLogo
                            platform={selectedJob.targets[0].platform}
                            size={24}
                          />
                        </div>
                      </div>

                      {/* Error Reason */}
                      {(selectedJob.targets[0].status === "failed" ||
                        selectedJob.targets[0].status === "partial") &&
                        selectedJob.targets[0].error && (
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-mono text-red-500 bg-red-500/5 p-3 rounded-lg border border-red-500/10 break-all">
                              {selectedJob.targets[0].error}
                            </div>
                            <Button
                              onClick={() => handleRetry(selectedJob)}
                              className="w-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                              size="sm"
                            >
                              <RefreshCcw size={14} className="mr-2" /> Retry
                              Operation
                            </Button>
                          </div>
                        )}
                    </div>
                  ) : (
                    /* Grouped View */
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {selectedJob.targets
                            .slice(0, 3)
                            .map((t: any, i: number) => (
                              <PlatformLogo
                                key={i}
                                platform={t.platform}
                                size={24}
                                className="ring-2 ring-background rounded-full"
                              />
                            ))}
                          {selectedJob.targets.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold ring-2 ring-background">
                              +{selectedJob.targets.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-xs">
                          {selectedJob.targets.length} Targets
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] uppercase font-bold"
                        onClick={() => setIsDetailsOpen(true)}
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Only show global error if it exists and is different from target error (simplified check) */}
            {selectedJob.errorMessage && selectedJob.targets.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500">
                  Failure Reason
                </h4>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400 font-mono break-all">
                  {selectedJob.errorMessage}
                </div>
                <Button
                  onClick={() => handleRetry(selectedJob)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                  size="sm"
                >
                  <RefreshCcw size={14} className="mr-2" /> Retry Operation
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Detailed Jobs Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title="Execution Details"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Content</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {selectedJob?.targets.map((target: any, i: number) => (
                  <tr key={i} className="hover:bg-secondary/20">
                    <td className="p-3 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs">
                          {target.contentTitle !== "Unknown"
                            ? target.contentTitle
                            : "Content"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <PlatformLogo platform={target.platform} size={16} />
                        <span className="text-xs">
                          {target.handle || target.platform}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={target.status} />
                    </td>
                    <td className="p-3">
                      {target.error ? (
                        <span className="text-[10px] font-mono text-red-500 break-all">
                          {target.error}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
