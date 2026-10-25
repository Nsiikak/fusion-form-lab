import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { NIGERIAN_STATES } from "@/lib/categories";
import { cn } from "@/lib/utils";

const radio = (on: boolean) => cn("rounded-xl border px-3 py-2.5 text-left", on ? "border-primary bg-[hsl(var(--primary-pale))]" : "border-border bg-white");
const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

/** Vendor profile: delivery fee by state (with optional interstate) and the mobilisation advance. */
const DeliveryAdvanceSettings = ({ vendor }: { vendor: any }) => {
  const queryClient = useQueryClient();
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const { data: elig } = useQuery({ queryKey: ["advance-eligibility"], queryFn: api.vendors.advanceEligibility });
  const unlocked = (v: string) => v === "none" || !!elig?.[v];
  const progress = (v: string) => v === "logistics"
    ? `${Math.min(elig?.completed ?? 0, 3)} of 3 completed bookings`
    : `${Math.min(elig?.completed ?? 0, 5)} of 5 completed bookings · account ${Math.min(elig?.account_days ?? 0, 60)} of 60 days`;
  useEffect(() => {
    if (vendor && !f) setF({
      base_state: vendor.base_state || "", logistics_fee: vendor.logistics_fee ? String(Number(vendor.logistics_fee)) : "",
      interstate_mode: vendor.interstate_mode || "none", interstate_fee: vendor.interstate_fee ? String(Number(vendor.interstate_fee)) : "",
      state_fees: Object.entries(vendor.state_fees || {}).map(([state, fee]) => ({ state, fee: String(fee) })),
      advance_mode: vendor.advance_mode || "none", advance_percent: String(vendor.advance_percent || 20),
    });
  }, [vendor, f]);
  if (!f) return null;
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));

  const save = async () => {
    if (!f.base_state) return toast.error("Choose the state you're based in");
    setBusy(true);
    try {
      await api.vendors.updateMyVendor({
        base_state: f.base_state, logistics_fee: Number(f.logistics_fee || 0),
        interstate_mode: f.interstate_mode, interstate_fee: f.interstate_fee ? Number(f.interstate_fee) : null,
        state_fees: Object.fromEntries(f.state_fees.filter((r: any) => r.state && r.fee).map((r: any) => [r.state, Number(r.fee)])),
        advance_mode: unlocked(f.advance_mode) ? f.advance_mode : "none", advance_percent: f.advance_mode === "logistics_plus" ? Number(f.advance_percent) : 0,
      });
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
      toast.success("Logistics and advance settings saved");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Couldn't save. Check the amounts and try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-w-0 bg-white border border-border rounded-2xl p-6 lg:col-span-2 space-y-6">
      <div className="flex items-start gap-3">
        <Truck className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h2 className="text-base font-bold">Logistics</h2>
          <p className="text-xs text-muted-foreground">Transport, delivery and setup costs: one flat fee for anywhere in your state. Plagohive takes no commission on logistics.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-medium text-muted-foreground">Your state
          <select className={cn(select, "mt-1")} value={f.base_state} onChange={(e) => set({ base_state: e.target.value })}>
            <option value="">Choose state</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Logistics fee within {f.base_state || "your state"} (₦)
          <Input className="mt-1" inputMode="numeric" placeholder="0 if included in your prices" value={f.logistics_fee}
            onChange={(e) => set({ logistics_fee: e.target.value.replace(/[^\d]/g, "") })} />
        </label>
      </div>
      <div>
        <p className="text-sm font-semibold mb-2">Events in other states</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {[["none", "Don't accept", "Customers elsewhere are told you serve your state only"], ["flat", "One flat fee", "Same fee for any other state"],
            ["per_state", "Fee per state", "Set a fee for each state you travel to"]].map(([v, l, h]) => (
            <button key={v} type="button" onClick={() => set({ interstate_mode: v })} className={radio(f.interstate_mode === v)}>
              <span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-muted-foreground">{h}</span>
            </button>
          ))}
        </div>
        {f.interstate_mode !== "none" && (
          <div className="mt-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">{f.interstate_mode === "flat" ? "Fee for any other state (₦)" : "Fee for states not listed below (optional, ₦)"}
              <Input className="mt-1 max-w-xs" inputMode="numeric" value={f.interstate_fee} onChange={(e) => set({ interstate_fee: e.target.value.replace(/[^\d]/g, "") })} />
            </label>
            {f.interstate_mode === "per_state" && (
              <div className="space-y-2">
                {f.state_fees.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2">
                    <select className={select} value={r.state} onChange={(e) => set({ state_fees: f.state_fees.map((x: any, j: number) => (j === i ? { ...x, state: e.target.value } : x)) })}>
                      <option value="">State</option>{NIGERIAN_STATES.filter((s) => s !== f.base_state).map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <Input inputMode="numeric" placeholder="₦" value={r.fee} onChange={(e) => set({ state_fees: f.state_fees.map((x: any, j: number) => (j === i ? { ...x, fee: e.target.value.replace(/[^\d]/g, "") } : x)) })} />
                    <Button variant="ghost" size="icon" aria-label="Remove state" onClick={() => set({ state_fees: f.state_fees.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => set({ state_fees: [...f.state_fees, { state: "", fee: "" }] })}><Plus className="h-4 w-4 mr-1" /> Add a state</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-start gap-3 mb-3">
          <Wallet className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-base font-bold">Preparation advance</h2>
            <p className="text-xs text-muted-foreground">Get part of the payment up to 3 days before the event, once you've reconfirmed, to buy supplies. Customers see it before they pay. The logistics fee needs 3 completed bookings with no strikes; a share for perishables needs 5 completed bookings and an account at least 60 days old. Advances are capped at ₦150,000 per booking and ₦300,000 outstanding at a time.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {[["none", "No advance", "Paid in full after the event"], ["logistics", "Logistics fee", "Your logistics fee early (recommended)"],
            ["logistics_plus", "Logistics + a share", "Logistics plus up to 30% for perishables"]].map(([v, l, h]) => (
            <button key={v} type="button" disabled={!unlocked(v)} aria-disabled={!unlocked(v)}
              onClick={() => unlocked(v) && set({ advance_mode: v })}
              className={cn(radio(f.advance_mode === v), !unlocked(v) && "opacity-60 cursor-not-allowed")}>
              <span className="block text-sm font-semibold">{l}{!unlocked(v) && " \u{1F512}"}</span>
              <span className="block text-xs text-muted-foreground">{unlocked(v) ? h : `Locked: ${progress(v)}`}</span>
            </button>
          ))}
        </div>
        {elig?.strikes_90d > 0 && <p className="text-xs text-destructive mt-2">Advances are paused while you have a strike from the last 90 days.</p>}
        {f.advance_mode === "logistics_plus" && (
          <label className="text-xs font-medium text-muted-foreground block mt-3">Share of your item prices
            <select className={cn(select, "mt-1 max-w-[160px]")} value={f.advance_percent} onChange={(e) => set({ advance_percent: e.target.value })}>
              {["10", "15", "20", "25", "30"].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </label>
        )}
        <p className="text-xs text-muted-foreground mt-3">If you cancel after receiving an advance, the customer is refunded in full and the advance is recovered from your future payouts.</p>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save settings</Button></div>
    </div>
  );
};

export default DeliveryAdvanceSettings;
