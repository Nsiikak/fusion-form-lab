import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const label = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const slots = (from: number, to: number) =>
  Array.from({ length: (to - from) * 2 }, (_, i) => `${String(from + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const GROUPS = [
  { name: "Morning", times: slots(6, 12) },
  { name: "Afternoon", times: slots(12, 17) },
  { name: "Evening", times: slots(17, 24) },
];

/** Friendly start-time picker: tap a half-hour slot instead of fighting a native time input. */
const TimePicker = ({ value, onChange, placeholder = "Choose a start time" }: { value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("w-full h-11 rounded-xl border border-input bg-white px-3 flex items-center gap-2 text-sm text-left",
          !value && "text-muted-foreground")}>
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{value ? label(value) : placeholder}</span>
          {value && (
            <span role="button" tabIndex={0} aria-label="Clear time" onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,340px)] p-3" align="start">
        <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
          {GROUPS.map((g) => (
            <div key={g.name}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{g.name}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {g.times.map((t) => (
                  <button key={t} type="button" onClick={() => { onChange(t); setOpen(false); }}
                    className={cn("rounded-lg border px-1 py-2 text-xs font-medium transition-colors",
                      value === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 hover:bg-[hsl(var(--primary-pale))]")}>
                    {label(t)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TimePicker;
