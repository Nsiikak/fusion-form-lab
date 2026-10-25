import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, MetricsParams } from "@/lib/api";
import { cn, formatNaira } from "@/lib/utils";

const PERIODS: { label: string; params: MetricsParams }[] = [
  { label: "7 days", params: { days: 7 } },
  { label: "30 days", params: { days: 30 } },
  { label: "90 days", params: { days: 90 } },
  { label: "12 months", params: { days: 365 } },
  { label: "All time", params: { all_time: true } },
];

type Kind = "n" | "ngn" | "pct";
const show = (v: number | null | undefined, kind: Kind) =>
  v === null || v === undefined ? "\u2014" : kind === "ngn" ? formatNaira(v) : kind === "pct" ? `${v}%` : v.toLocaleString();

const GROUPS: { title: string; items: [string, string, Kind, string?][] }[] = [
  { title: "Growth", items: [
    ["paid_bookings", "Paid bookings", "n"], ["gmv", "Booking value (GMV)", "ngn"], ["unique_customers", "Customers who booked", "n"],
    ["new_customers", "New customer sign-ups", "n"], ["checkout_conversion_pct", "Checkout conversion", "pct", "Paid ÷ checkouts started"],
  ] },
  { title: "Money", items: [
    ["revenue", "Plagohive revenue", "ngn", "Commission + platform fees"], ["take_rate_pct", "Take rate", "pct"],
    ["average_booking_value", "Average booking value", "ngn"], ["average_customer_value", "Average value per customer", "ngn"],
    ["payouts_paid", "Paid out to vendors", "ngn"],
  ] },
  { title: "Quality and trust", items: [
    ["acceptance_rate_pct", "Vendor acceptance rate", "pct"], ["completed_bookings", "Completed bookings", "n"],
    ["cancellation_rate_pct", "Cancellation rate", "pct"], ["dispute_rate_pct", "Dispute rate", "pct"],
    ["no_shows", "Vendor no-shows", "n"], ["refunded_total", "Refunded to customers", "ngn"], ["repeat_customer_pct", "Repeat customers", "pct"],
  ] },
  { title: "Supply", items: [
    ["active_vendors", "Active verified vendors", "n"], ["vendors_with_bookings", "Vendors with a booking", "n"],
    ["new_vendors", "New vendor sign-ups", "n"], ["pending_vendors", "Awaiting verification", "n"],
  ] },
];

const MetricsPanel = () => {
  const [period, setPeriod] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const params = PERIODS[period].params;
  const { data, isLoading } = useQuery({ queryKey: ["admin", "metrics", params], queryFn: () => api.admin.metrics(params) });

  const download = async (format: "pdf" | "csv") => {
    setBusy(format);
    try { await api.admin.downloadReport(params, format); }
    catch { toast.error("Couldn't create the report. Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Period">
          {PERIODS.map((p, i) => (
            <button key={p.label} role="tab" aria-selected={i === period} onClick={() => setPeriod(i)}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors",
                i === period ? "bg-navy text-navy-foreground border-navy" : "bg-white border-border hover:border-primary/40")}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download("pdf")}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} PDF report
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download("csv")}>
            {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />
      ) : (
        <>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{g.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {g.items.map(([key, label, kind, hint]) => (
                  <Card key={key} className="p-4 bg-white border-border" title={hint}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums">{show(data.kpis[key], kind)}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <Card className="p-4 sm:p-5 bg-white border-border">
            <h3 className="font-semibold">Bookings and revenue by {data.period.unit}</h3>
            <p className="text-xs text-muted-foreground mb-3">Bars: paid bookings · Line: Plagohive revenue (₦)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAD9C2" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={(p: string) => p.slice(5) || p} minTickGap={16} />
                  <YAxis yAxisId="b" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v: number, name: string) => (name === "revenue" ? formatNaira(v) : v)} />
                  <Bar yAxisId="b" dataKey="bookings" name="bookings" fill="#13213C" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" dataKey="revenue" name="revenue" stroke="#E8770E" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 sm:p-5 bg-white border-border">
              <h3 className="font-semibold mb-3">By category</h3>
              {data.by_category.length === 0 ? <p className="text-sm text-muted-foreground">No paid bookings in this period.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">Category</th><th className="text-right">Bookings</th><th className="text-right">Value</th></tr></thead>
                  <tbody>{data.by_category.map((r) => (
                    <tr key={r.category} className="border-t border-border/60"><td className="py-2 capitalize">{r.category}</td><td className="text-right">{r.bookings}</td><td className="text-right">{formatNaira(r.gmv)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </Card>
            <Card className="p-4 sm:p-5 bg-white border-border">
              <h3 className="font-semibold mb-3">Top vendors</h3>
              {data.top_vendors.length === 0 ? <p className="text-sm text-muted-foreground">No paid bookings in this period.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">Vendor</th><th className="text-right">Bookings</th><th className="text-right">Value</th></tr></thead>
                  <tbody>{data.top_vendors.map((r) => (
                    <tr key={r.vendor} className="border-t border-border/60"><td className="py-2 truncate max-w-[180px]">{r.vendor}</td><td className="text-right">{r.bookings}</td><td className="text-right">{formatNaira(r.gmv)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricsPanel;
