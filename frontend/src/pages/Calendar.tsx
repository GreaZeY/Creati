import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  List,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe,
  MoreVertical,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { postsAPI, agencyAPI } from "@/lib/api";
import { LensedCard } from "@/components/ui/LensedCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { toast } from "@/lib/events";

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const start = format(startOfWeek(startOfMonth(currentDate)), "yyyy-MM-dd");
  const end = format(endOfWeek(endOfMonth(currentDate)), "yyyy-MM-dd");

  const { data: calendarData, refetch } = useQuery({
    queryKey: ["global-calendar", start, end],
    queryFn: async () => {
      const res = await postsAPI.getCalendar(start, end);
      return res.data.data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const res = await agencyAPI.listClients();
      return res.data.data;
    },
  });

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const filteredData = useMemo(() => {
    if (!calendarData) return [];
    return calendarData.filter((item: any) => {
      const clientMatch =
        selectedClient === "all" || item.clientId.toString() === selectedClient;
      const platformMatch =
        selectedPlatform === "all" || item.platform === selectedPlatform;
      return clientMatch && platformMatch;
    });
  }, [calendarData, selectedClient, selectedPlatform]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((d: any) => d.id));
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      await postsAPI.batchUpdateStatus(selectedIds, status);
      toast.success(
        `Batch update successful: ${selectedIds.length} items set to ${status}`,
      );
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error("Failed to perform bulk update");
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Clock className="w-3 h-3 text-cyan-400" />;
      case "completed":
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-rose-400" />;
      default:
        return <Clock className="w-3 h-3 text-amber-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 pb-12 max-w-7xl mx-auto px-8 w-full relative z-0">
      <PageHeader
        title="Global Operations"
        description="Master orchestration layer for all distribution nodes and scheduled content cycles."
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-secondary/30 rounded-2xl border border-border/50">
            <button
              onClick={() => setView("month")}
              className={cn(
                "p-2 rounded-xl transition-all",
                view === "month"
                  ? "bg-primary text-white shadow-xl shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarIcon size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-2 rounded-xl transition-all",
                view === "list"
                  ? "bg-primary text-white shadow-xl shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List size={16} />
            </button>
          </div>

          <div className="h-8 w-[1px] bg-border/50 mx-2" />

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="rounded-xl border-border/50 uppercase font-black text-[9px] tracking-widest"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="h-8 w-8 rounded-lg"
            >
              <ChevronLeft size={16} />
            </Button>
            <h3 className="text-sm font-black uppercase tracking-tighter min-w-[120px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="h-8 w-8 rounded-lg"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex gap-4 items-center">
        <LensedCard className="flex-1 p-2 flex items-center gap-4 bg-secondary/20 border-border/50">
          <div className="flex items-center gap-2 px-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Filters
            </span>
          </div>

          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase tracking-widest border-0 focus:ring-0 cursor-pointer"
          >
            <option value="all">All Clients</option>
            {clients?.map((cl: any) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>

          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase tracking-widest border-0 focus:ring-0 cursor-pointer"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">X (Twitter)</option>
          </select>

          {view === "list" && (
            <div className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={
                  selectedIds.length === filteredData.length &&
                  filteredData.length > 0
                }
                onChange={toggleSelectAll}
                className="rounded border-border bg-transparent text-primary focus:ring-primary"
              />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Select All
              </span>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-4 px-4 pr-6">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                Scheduled
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                Success
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                Failed
              </span>
            </div>
          </div>
        </LensedCard>
      </div>

      <AnimatePresence mode="wait">
        {view === "month" ? (
          <motion.div
            key="month-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="flex-1 grid grid-cols-7 border-t border-l border-border/40 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border"
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="p-3 text-center border-r border-b border-border/40 bg-secondary/10"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {d}
                </span>
              </div>
            ))}

            {monthDays.map((day, i) => {
              const dayPosts = filteredData.filter((item: any) =>
                isSameDay(new Date(item.scheduledAt), day),
              );
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[140px] p-2 border-r border-b border-border/40 relative transition-colors duration-500",
                    !isCurrentMonth
                      ? "bg-secondary/5 opacity-50"
                      : "bg-card/20 hover:bg-secondary/10",
                    isToday(day) &&
                      "bg-primary/5 ring-inset ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={cn(
                        "text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg",
                        isToday(day)
                          ? "bg-primary text-white font-bold"
                          : "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[8px] font-black bg-secondary/50 px-1.5 py-0.5 rounded-md border border-border">
                        {dayPosts.length} EVENTS
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden h-24">
                    {dayPosts.slice(0, 3).map((post: any) => (
                      <motion.div
                        key={post.id}
                        initial={{ x: -5, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="p-1 px-1.5 rounded-lg border border-border/50 flex items-center gap-1.5 cursor-pointer hover:bg-background/80 transition-all group overflow-hidden"
                      >
                        <div
                          className="w-1 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: post.clientColor }}
                        />
                        <div className="flex-1 truncate">
                          <p className="text-[8px] font-bold truncate leading-tight">
                            {post.title}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 opacity-60">
                            <PlatformLogo
                              platform={post.platform}
                              size={6}
                              className="text-primary"
                            />
                            <span className="text-[7px] font-black uppercase tracking-tighter truncate">
                              {post.clientName}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {getStatusIcon(post.status)}
                        </div>
                      </motion.div>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[8px] font-black text-center text-muted-foreground py-1 bg-secondary/20 rounded-lg">
                        + {dayPosts.length - 3} MORE
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {filteredData.length > 0 ? (
              filteredData.map((post: any) => (
                <LensedCard
                  key={post.id}
                  className={cn(
                    "p-4 flex items-center gap-6 hover:ring-primary/40 transition-all group relative overflow-hidden",
                    selectedIds.includes(post.id) &&
                      "ring-1 ring-primary bg-primary/5 shadow-glass",
                  )}
                >
                  <div className="shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="rounded border-border bg-transparent text-primary focus:ring-primary h-4 w-4"
                    />
                  </div>

                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg"
                    style={{ backgroundColor: post.clientColor }}
                  >
                    {post.clientName.charAt(0)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-black tracking-tight">
                        {post.title}
                      </h4>
                      <div className="px-2 py-0.5 bg-secondary/50 border border-border rounded-full text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                        {post.scheduledStatus || "Draft"}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <PlatformLogo
                          platform={post.platform}
                          size={10}
                          className="text-primary"
                        />{" "}
                        {post.platform}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-border" />
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> {post.clientName}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-border" />
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />{" "}
                        {format(new Date(post.scheduledAt), "MMM dd, HH:mm")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border">
                      {getStatusIcon(post.status)}
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {post.status}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit3 size={16} className="text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical
                        size={16}
                        className="text-muted-foreground"
                      />
                    </Button>
                  </div>
                </LensedCard>
              ))
            ) : (
              <div className="p-32 text-center rounded-[3rem] border-2 border-dashed border-border/50 bg-secondary/5">
                <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold uppercase tracking-tight italic">
                  Silent Horizon
                </h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                  No distribution cycles scheduled for this time vector. Start a
                  new blast to fill the timeline.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 100, x: "-50%", opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] preserve-3d"
          >
            <LensedCard className="p-3 px-6 flex items-center gap-8 bg-charcoal/90 dark:bg-charcoal/80 backdrop-blur-3xl border-primary/20 shadow-2xl shadow-primary/20 ring-1 ring-primary/30 rounded-[2rem]">
              <div className="flex items-center gap-4 border-r border-white/10 pr-6 mr-2">
                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-black italic shadow-lg shadow-primary/30">
                  {selectedIds.length}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    Batched Selection
                  </span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                    Global Operations Active
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleBulkStatusUpdate("scheduled")}
                  className="rounded-xl h-10 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-[10px] tracking-widest border-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Approve & Sync
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate("rejected")}
                  className="rounded-xl h-10 px-6 border-rose-500/50 hover:bg-rose-500/20 text-rose-400 font-black uppercase text-[10px] tracking-widest"
                >
                  <AlertCircle className="w-3.5 h-3.5 mr-2" /> Hold / Reject
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                  className="rounded-xl h-10 px-4 text-white/50 hover:text-white font-black uppercase text-[10px] tracking-widest"
                >
                  Cancel
                </Button>
              </div>
            </LensedCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
