import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { postsAPI, agencyAPI } from "@/lib/api";
import { toast } from "@/lib/events";

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const start = formatStart(startOfMonth(currentDate));
  const end = formatEnd(endOfMonth(currentDate));

  const { data: calendarData, refetch, isLoading } = useQuery({
    queryKey: ["agency-calendar", start, end],
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
    const startWeek = startOfWeek(startOfMonth(currentDate));
    const endWeek = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  }, [currentDate]);

  const filteredData = useMemo(() => {
    if (!calendarData) return [];
    return calendarData.filter((item: { clientId: number | string; platform: string }) => {
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
      setSelectedIds(filteredData.map((d: { id: string }) => d.id));
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
    } catch {
      toast.error("Failed to perform bulk update");
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return {
    currentDate,
    view,
    setView,
    selectedClient,
    setSelectedClient,
    selectedPlatform,
    setSelectedPlatform,
    selectedIds,
    setSelectedIds,
    calendarData,
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
  };
}

function formatStart(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatEnd(d: Date) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}
