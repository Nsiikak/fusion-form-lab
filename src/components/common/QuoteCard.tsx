import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaystackPayment } from "react-paystack";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatNaira } from "@/lib/utils";

const err = (e: any, f: string) => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : f);

/** A vendor's quote (an unpaid booking): Accept & pay, or Decline. Shown in chat and on the dashboard. */
const QuoteCard = ({ bookingId, role, compact = false }: { bookingId: number; role: "customer" | "vendor"; compact?: boolean }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: b, refetch } = useQuery({ queryKey: ["booking", bookingId], queryFn: () => api.bookings.getById(bookingId) });
  const pay = usePaystackPayment({ publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "", email: user?.email || "", amount: 0 });
  const [busy, setBusy] = useState(false);
  if (!b) return <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />;

  const open = b.status === "awaiting_payment";
  const expired = b.quote_expires_at && new Date(b.quote_expires_at) < new Date();
  const items: any[] = b.service_items_snapshot || [];
  const done = () => { refetch(); queryClient.invalidateQueries({ queryKey: ["bookings"] }); queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] }); };

  const accept = () => {
    setBusy(true);
    pay({
      config: { email: user?.email || "", amount: Math.round(Number(b.price) * 100), reference: b.payment_reference, currency: "NGN" },
      onSuccess: async (res: any) => {
        try { await api.bookings.verifyPayment(b.id, res?.reference); toast.success("Quote paid. Your booking is confirmed and the money is held safely."); }
        catch (e) { toast.info("Payment received. We're confirming it with Paystack; your booking will update within a few minutes."); }
        done(); setBusy(false);
      },
      onClose: () => { setBusy(false); toast.info("Payment window closed. You haven't been charged."); },
    });
  };
  const decline = async () => {
    setBusy(true);
    try { await api.bookings.declineQuote(b.id); done(); } catch (e) { toast.error(err(e, "Couldn't update the quote.")); } finally { setBusy(false); }
  };

  return (
    <div className={cn("rounded-2xl border bg-white text-foreground text-left", open && !expired ? "border-primary/40" : "border-border", compact ? "p-3" : "p-4")}>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold flex-1">Quote{role === "customer" && b.vendor_name ? ` from ${b.vendor_name}` : ""}</p>
        <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5",
          open && !expired ? "bg-[hsl(var(--primary-pale))] text-[hsl(var(--primary-deep))]" : b.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-800")}>
          {open && !expired ? "Waiting for payment" : b.status === "cancelled" ? (b.cancellation_reason || "Closed") : "Paid \u00b7 confirmed"}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3"><span className="text-muted-foreground">{it.name}{it.quantity > 1 ? ` \u00d7 ${it.quantity}` : ""}</span><span>{formatNaira(it.subtotal)}</span></li>
        ))}
        {role === "customer" && b.platform_fee != null && (
          <li className="flex justify-between gap-3 text-muted-foreground"><span>Platform fee</span><span>{formatNaira(b.platform_fee)}</span></li>
        )}
        <li className="flex justify-between gap-3 font-bold border-t border-border pt-1.5">
          <span>{role === "customer" ? "Total" : "Your price"}</span><span>{formatNaira(b.price)}</span>
        </li>
      </ul>
      <p className="text-xs text-muted-foreground mt-2">
        For {format(new Date(b.event_date), "EEE d MMM yyyy")}{b.event_time ? `, ${String(b.event_time).slice(0, 5)}` : ""}
        {b.quote_expires_at && open ? ` \u00b7 valid until ${format(new Date(b.quote_expires_at), "d MMM, HH:mm")}` : ""}
      </p>
      {b.notes && <p className="text-xs text-muted-foreground italic mt-1">"{b.notes}"</p>}
      {open && !expired && (
        <div className="flex flex-wrap gap-2 mt-3">
          {role === "customer" ? (
            <>
              <Button size="sm" className="rounded-lg" disabled={busy} onClick={accept}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Accept &amp; pay {formatNaira(b.price)}</Button>
              <Button size="sm" variant="ghost" className="rounded-lg" disabled={busy} onClick={decline}>Decline</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy} onClick={decline}>Withdraw quote</Button>
          )}
        </div>
      )}
      {open && role === "customer" && !expired && (
        <p className="text-[11px] text-muted-foreground mt-2">Your money is held until you confirm the service, under the vendor's cancellation policy.</p>
      )}
    </div>
  );
};

export default QuoteCard;
