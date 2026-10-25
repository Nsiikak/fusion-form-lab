import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { api } from "@/lib/api";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Vendor profile: days you can't work, and how many bookings you can take in one day. */
const AvailabilitySettings = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-availability"], queryFn: api.vendors.myAvailability });
  const [days, setDays] = useState<Date[]>([]);
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setDays(data.blocked_dates.map((d) => new Date(`${d}T00:00:00`)));
    setCapacity(data.daily_capacity ? String(data.daily_capacity) : "");
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await api.vendors.setMyAvailability({ blocked_dates: days.map(iso), daily_capacity: capacity ? Number(capacity) : null });
      queryClient.invalidateQueries({ queryKey: ["my-availability"] });
      toast.success("Availability saved. Customers won't be able to book you on blocked days.");
    } catch (e: any) {
      const d = e?.response?.data?.detail; toast.error(typeof d === "string" ? d : "Couldn't save availability.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-w-0 bg-white border border-border rounded-2xl p-6 lg:col-span-2">
      <div className="flex items-start gap-3 mb-4">
        <CalendarX className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h2 className="text-base font-bold">Availability</h2>
          <p className="text-xs text-muted-foreground">Tap the days you can't work (already booked elsewhere, travelling, a break). Customers can't pick them, and you won't appear in searches for those dates.</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:items-start">
        <div className="rounded-xl border border-border w-fit max-w-full overflow-x-auto">
          <Calendar mode="multiple" selected={days} onSelect={(d) => setDays(d || [])} disabled={(d) => d < new Date(new Date().toDateString())} />
        </div>
        <div className="space-y-4 flex-1 min-w-0">
          <p className="text-sm"><b>{days.length}</b> day{days.length === 1 ? "" : "s"} blocked</p>
          <label className="block text-xs font-medium text-muted-foreground">Bookings you can take in one day
            <select value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1 h-10 w-full max-w-[220px] rounded-md border border-input bg-white px-3 text-sm">
              <option value="">No limit</option>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">Once you have this many bookings on a day, that day closes automatically.</p>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save availability</Button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilitySettings;
