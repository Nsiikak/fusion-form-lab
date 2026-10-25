import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { api } from "@/lib/api";
import { allTaskIds, occasionBySlug, taskKey } from "@/lib/occasions";
import { cn } from "@/lib/utils";

/** Inside an event card: the occasion's checklist (ticks saved to the event) and vendors still needed. */
const EventChecklist = ({ event, bookedCategories = [] }: { event: any; bookedCategories?: string[] }) => {
  const occasion = occasionBySlug(event.event_type);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>(event.checklist || {});
  if (!occasion) return null;
  const ids = allTaskIds(occasion);
  const count = ids.filter((k) => done[k]).length;
  const pct = Math.round((100 * count) / ids.length);

  const toggle = async (key: string) => {
    const next = { ...done, [key]: !done[key] };
    if (!next[key]) delete next[key];
    setDone(next);
    try {
      await api.events.update(event.id, { checklist: next } as any);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch {
      setDone(done);
      toast.error("Couldn't save. Please try again.");
    }
  };

  const needed = occasion.vendors.filter((v) => !bookedCategories.includes(v.category));
  return (
    <div className="mt-3 rounded-2xl border border-border bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{occasion.name} checklist &middot; {count}/{ids.length} done</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {needed.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Still to book</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {needed.map((v) => (
                  <Link key={v.label} to={`/vendor-search?category=${v.category}&event_id=${event.id}`}
                    className="text-xs font-medium rounded-full border border-primary/30 text-primary px-2.5 py-1 hover:bg-[hsl(var(--primary-pale))]">
                    + {v.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {occasion.stages.map((s) => (
            <div key={s.when}>
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary-deep))]">{s.when}</p>
              <ul className="mt-1.5 space-y-1">
                {s.tasks.map((t) => {
                  const k = taskKey(s.when, t.id), on = !!done[k];
                  return (
                    <li key={k}>
                      <button type="button" onClick={() => toggle(k)} className="flex items-start gap-2 text-left text-sm w-full py-1">
                        {on ? <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px] text-celebrate-emerald flex-shrink-0 mt-0.5" /> : <Circle className="h-[18px] w-[18px] text-muted-foreground/50 flex-shrink-0 mt-0.5" />}
                        <span className={cn(on && "line-through text-muted-foreground")}>{t.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventChecklist;
