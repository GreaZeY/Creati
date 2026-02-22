import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  List,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LensedCard } from "@/components/ui/LensedCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { useCalendar } from "@/hooks/useCalendar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dropdown } from "@/components/ui/Dropdown";

export const Calendar = () => {
  const {
    currentDate,
    view,
    setView,
    selectedClient,
    setSelectedClient,
    selectedPlatform,
    setSelectedPlatform,
    selectedIds,
    setSelectedIds,
    clients,
    monthDays,
    filteredData,
    isLoading,
    toggleSelect,
    toggleSelectAll,
    handleBulkStatusUpdate,
    nextMonth,
    prevMonth,
    goToToday,
  } = useCalendar();

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

  const columns: Column<{
    id: string;
    clientName: string;
    clientColor: string;
    title: string;
    platform: string;
    scheduledAt: string;
    status: string;
  }>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={
            selectedIds.length === filteredData.length &&
            filteredData.length > 0
          }
          onChange={toggleSelectAll}
          className="rounded border-border bg-transparent text-primary focus:ring-primary h-4 w-4"
        />
      ),
      cell: (item) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={() => toggleSelect(item.id)}
          className="rounded border-border bg-transparent text-primary focus:ring-primary h-4 w-4"
        />
      ),
      className: "w-12",
    },
    {
      header: "Client",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-lg"
            style={{ backgroundColor: item.clientColor }}
          >
            {item.clientName.charAt(0)}
          </div>
          <span className="text-xs font-bold">{item.clientName}</span>
        </div>
      ),
    },
    {
      header: "Post Title",
      cell: (item) => (
        <div className="space-y-1">
          <h4 className="text-xs font-black tracking-tight truncate max-w-[200px]">
            {item.title}
          </h4>
          <div className="flex items-center gap-2">
            <PlatformLogo
              platform={item.platform}
              size={10}
              className="text-primary"
            />
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
              {item.platform}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Schedule",
      cell: (item) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock size={12} />
          <span className="text-[10px] font-bold">
            {format(new Date(item.scheduledAt), "MMM dd, HH:mm")}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (item) => (
        <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border w-fit">
          {getStatusIcon(item.status)}
          <span className="text-[9px] font-black uppercase tracking-tighter">
            {item.status}
          </span>
        </div>
      ),
    },
    {
      header: "",
      cell: () => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit3 size={14} className="text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical size={14} className="text-muted-foreground" />
          </Button>
        </div>
      ),
      className: "w-20",
    },
  ];

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
              Scope
            </span>
          </div>

          <Dropdown
            id="client-filter"
            size="sm"
            value={selectedClient}
            onChange={(item) => setSelectedClient(item.value)}
            items={[
              { id: "all", label: "All Clients", value: "all" },
              ...(clients?.map((cl: any) => ({
                id: cl.id,
                label: cl.name,
                value: cl.id.toString(),
              })) || []),
            ]}
          />

          <Dropdown
            id="platform-filter"
            size="sm"
            value={selectedPlatform}
            onChange={(item) => setSelectedPlatform(item.value)}
            items={[
              { id: "all", label: "All Platforms", value: "all" },
              { id: "youtube", label: "YouTube", value: "youtube" },
              { id: "instagram", label: "Instagram", value: "instagram" },
              { id: "facebook", label: "Facebook", value: "facebook" },
              { id: "twitter", label: "X (Twitter)", value: "twitter" },
            ]}
          />

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
            className="flex-1 relative min-h-0"
          >
            <DataTable
              data={filteredData}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No scheduled distribution cycles found for this time vector."
            />
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
