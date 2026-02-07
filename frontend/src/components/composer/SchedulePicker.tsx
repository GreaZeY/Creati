import { useState, useEffect } from "react";
import { Calendar, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isBefore } from "date-fns";

interface SchedulePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
}

export function SchedulePicker({
  value,
  onChange,
  className,
}: SchedulePickerProps) {
  const [mode, setMode] = useState<"now" | "later">(value ? "later" : "now");
  const [selectedDate, setSelectedDate] = useState<string>(
    value ? format(value, "yyyy-MM-dd") : "",
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    value ? format(value, "HH:mm") : "",
  );

  // Sync internal state with external value
  useEffect(() => {
    if (mode === "now") {
      onChange(null);
    } else if (selectedDate && selectedTime) {
      const combined = new Date(`${selectedDate}T${selectedTime}`);
      if (!isBefore(combined, new Date())) {
        onChange(combined);
      }
    }
  }, [mode, selectedDate, selectedTime]);

  const scheduledFor = value
    ? formatDistanceToNow(value, { addSuffix: true })
    : null;

  const minDate = format(new Date(), "yyyy-MM-dd");
  const minTime =
    selectedDate === minDate ? format(new Date(), "HH:mm") : "00:00";

  return (
    <div
      className={cn(
        "space-y-4 p-4 rounded-xl border border-border/40 bg-card/20 backdrop-blur-sm",
        className,
      )}
    >
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("now")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all",
            mode === "now"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          <Zap size={14} />
          Publish Now
        </button>
        <button
          type="button"
          onClick={() => setMode("later")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all",
            mode === "later"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          <Calendar size={14} />
          Schedule
        </button>
      </div>

      {/* Date/Time Inputs */}
      {mode === "later" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Date */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground/60">
              <Calendar size={12} />
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={minDate}
              className="w-full h-11 px-4 rounded-xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-sm ring-1 ring-border/50"
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground/60">
              <Clock size={12} />
              Time
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              min={selectedDate === minDate ? minTime : undefined}
              className="w-full h-11 px-4 rounded-xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-sm ring-1 ring-border/50"
            />
          </div>

          {/* Preview */}
          {scheduledFor && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Publishing {scheduledFor}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
