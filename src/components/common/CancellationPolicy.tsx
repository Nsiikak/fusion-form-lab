import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { CalendarClock, Check } from "lucide-react";
import { api, CancellationPolicy as Policy } from "@/lib/api";
import { cn } from "@/lib/utils";

const ORDER = ["flexible", "standard", "strict"] as const;

const HINT: Record<string, string> = {
  flexible: "Good for DJs, MCs and services with little upfront cost",
  standard: "Recommended for most vendors",
  strict: "For perishables, custom builds and big upfront purchases",
};

export const usePolicies = () =>
  useQuery({ queryKey: ["cancellation-policies"], queryFn: api.bookings.policies, staleTime: Infinity });

/** Vendor setup: choose a policy. */
export const PolicyPicker = ({ value, onChange }: { value: string; onChange: (key: string) => void }) => {
  const { data } = usePolicies();
  if (!data) return null;
  return (
    <div className="grid gap-2.5" role="radiogroup" aria-label="Cancellation policy">
      {ORDER.map((key) => {
        const p = data[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={cn(
              "text-left rounded-2xl border p-4 transition-colors flex gap-3",
              active ? "border-primary bg-[hsl(var(--primary-pale))] ring-2 ring-primary/20" : "border-border bg-white hover:border-primary/40",
            )}
          >
            <span className={cn("mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              active ? "border-primary bg-primary text-white" : "border-border")}>
              {active && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span>
              <span className="font-semibold">{p.label}</span>
              {key === "standard" && <span className="ml-2 text-[11px] font-semibold text-celebrate-emerald">Recommended</span>}
              <span className="block text-sm text-foreground/80 mt-0.5">{p.summary}</span>
              <span className="block text-xs text-muted-foreground mt-1">{HINT[key]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** Customer-facing: the vendor's policy, with real dates when the event date is known. */
export const PolicySummary = ({ policyKey, eventDate, compact = false }: { policyKey?: string | null; eventDate?: Date; compact?: boolean }) => {
  const { data } = usePolicies();
  const p: Policy | undefined = data?.[policyKey || "standard"];
  if (!p) return null;
  return (
    <div className={cn("rounded-2xl border border-border bg-white", compact ? "p-3.5" : "p-4")}>
      <p className="flex items-center gap-2 font-semibold text-sm">
        <CalendarClock className="h-4 w-4 text-primary" /> {p.label} cancellation policy
      </p>
      {eventDate ? (
        <ul className="mt-2 space-y-1 text-sm">
          {p.tiers.map(([days, pct]) => {
            const until = subDays(eventDate, days);
            if (until < new Date()) return null;
            return (
              <li key={days} className="flex justify-between gap-3">
                <span className="text-muted-foreground">Cancel by {format(until, "EEE d MMM")}</span>
                <span className="font-medium">{pct === 100 ? "Full refund" : `${pct}% back`}</span>
              </li>
            );
          })}
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">After that</span>
            <span className="font-medium">No refund</span>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">{p.summary}</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Always a full refund if the vendor cancels, doesn't accept, or doesn't show up — and within 24 hours of booking for events a week or more away.
      </p>
    </div>
  );
};
