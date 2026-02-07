import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DayPicker } from "react-day-picker";
import { format, formatDistanceToNow, isBefore, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";
import "react-day-picker/dist/style.css";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
}

export function ScheduleModal({
  isOpen,
  onClose,
  onSchedule,
}: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [timeString, setTimeString] = useState<string>(
    format(addMinutes(new Date(), 30), "HH:mm"),
  );

  const handleSchedule = () => {
    if (!selectedDate) return;

    const [hours, minutes] = timeString.split(":").map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    if (isBefore(scheduledDate, new Date())) {
      alert("Cannot schedule in the past");
      return;
    }

    onSchedule(scheduledDate);
    onClose();
  };

  const combinedDate = selectedDate
    ? (() => {
        const [hours, minutes] = timeString.split(":").map(Number);
        const combined = new Date(selectedDate);
        combined.setHours(hours, minutes, 0, 0);
        return combined;
      })()
    : null;

  const isPast = combinedDate && isBefore(combinedDate, new Date());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Post">
      <div className="p-6 max-w-md">
        {/* Header */}
        <h2 className="text-lg font-black tracking-tight mb-4">
          Schedule Post
        </h2>

        {/* Calendar */}
        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            <Calendar size={12} className="inline mr-1" />
            Date
          </label>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={{ before: new Date() }}
            className={cn(
              "border border-border/40 rounded-lg p-3",
              "rdp-months { gap: 0 }",
              "rdp-day_selected { background: hsl(var(--primary)) }",
              "[&_.rdp-day_selected]:bg-primary [&_.rdp-day_selected]:text-primary-foreground",
            )}
          />
        </div>

        {/* Time Picker */}
        <div className="mb-6">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            <Clock size={12} className="inline mr-1" />
            Time
          </label>
          <input
            type="time"
            value={timeString}
            onChange={(e) => setTimeString(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-border/40 bg-background text-sm"
          />
        </div>

        {/* Preview */}
        {combinedDate && !isPast && (
          <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Will publish</p>
            <p className="text-sm font-bold">
              {formatDistanceToNow(combinedDate, { addSuffix: true })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(combinedDate, "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        )}

        {isPast && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400 font-bold">
              ⚠️ Selected time is in the past
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-9">
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={Boolean(!selectedDate || isPast)}
            className="flex-1 h-9"
          >
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
