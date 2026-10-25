import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaystackPayment } from "react-paystack";
import { toast } from "sonner";
import { Loader2, MinusCircle, Plus, PlusCircle, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, BookingAddon } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatNaira } from "@/lib/utils";

const err = (e: any, fallback: string) => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : fallback);
const OPEN = ["pending", "confirmed"];

/** Add-ons on a booking card. Vendors send priced extras; customers approve and pay, or decline. */
const AddonsPanel = ({ booking, role }: { booking: any; role: "customer" | "vendor" }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";
  const initializePayment = usePaystackPayment({ publicKey, email: user?.email || "", amount: 0 });
  const canAdd = role === "vendor" && OPEN.includes(booking.status) && new Date(booking.event_date) > new Date();
  const relevant = OPEN.includes(booking.status) || ["awaiting_confirmation", "completed", "disputed"].includes(booking.status);

  const { data: addons = [] } = useQuery({
    queryKey: ["addons", booking.id],
    queryFn: () => api.bookings.addons(booking.id),
    enabled: relevant && !!booking.paid_at,
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["addons", booking.id] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
  };

  const pay = async (a: BookingAddon) => {
    setBusy(a.id);
    try {
      const co = await api.bookings.addonCheckout(booking.id, a.id);
      initializePayment({
        config: { email: co.email, amount: co.amount_kobo, reference: co.reference, currency: "NGN" },
        onSuccess: async () => {
          try {
            await api.bookings.addonVerify(booking.id, a.id);
            toast.success("Add-on paid. It's held safely with the rest of your booking.");
          } catch (e) {
            toast.info(err(e, "Payment received. It will show on your booking shortly."));
          }
          refresh();
          setBusy(null);
        },
        onClose: () => { setBusy(null); toast.info("Payment window closed. You haven't been charged."); },
      });
    } catch (e) {
      toast.error(err(e, "Couldn't start the payment."));
      setBusy(null);
    }
  };

  const respond = async (a: BookingAddon, action: "decline" | "withdraw") => {
    setBusy(a.id);
    try { await api.bookings.addonRespond(booking.id, a.id, action); refresh(); }
    catch (e) { toast.error(err(e, "Couldn't update the add-on.")); }
    finally { setBusy(null); }
  };

  const canReduce = OPEN.includes(booking.status) && new Date(booking.event_date) > new Date()
    && (booking.service_items_snapshot || []).length > 0 && !!booking.paid_at;
  const [reduceOpen, setReduceOpen] = useState(false);
  const advance = Number(booking.advance_amount || 0);

  const respondBy = booking.status === "pending" && booking.respond_by ? new Date(booking.respond_by) : null;
  if (!relevant || (!addons.length && !canAdd && !canReduce && !advance && !respondBy)) return null;

  return (
    <div className="mt-3 space-y-2">
      {respondBy && (
        <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          {role === "vendor" ? "Please accept or decline by " : "The vendor has until "}
          <b>{respondBy.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>
          {role === "vendor" ? ", or the customer is refunded automatically." : " to respond. If they don't, you're refunded in full automatically."}
        </p>
      )}
      {advance > 0 && (
        <p className="text-xs rounded-xl bg-[hsl(var(--primary-pale))] border border-[hsl(var(--primary-light))] px-3 py-2 flex gap-2">
          <Wallet className="h-4 w-4 text-primary flex-shrink-0" />
          <span>
            Preparation advance {formatNaira(advance)}:{" "}
            {booking.advance_status === "paid" ? `released ${new Date(booking.advance_paid_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` :
              role === "vendor" ? "released to you 3 days before the event, once you've reconfirmed" : "released to the vendor 3 days before the event, once they reconfirm; the rest stays held"}
          </span>
        </p>
      )}
      {addons.filter((a) => a.status !== "withdrawn").map((a) => (
        <div key={a.id} className={cn("rounded-xl border px-3.5 py-3 text-sm",
          a.status === "proposed" ? "border-amber-200 bg-amber-50" : "border-border bg-muted/30")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {a.status === "proposed" ? (role === "customer" ? "Add-on waiting for you" : "Add-on sent, waiting for the customer")
                  : a.status === "paid" ? "Add-on paid" : a.status === "declined" ? "Add-on declined" : "Add-on refunded"}
              </p>
              <p className="text-muted-foreground">{a.items.map((i) => `${i.name} \u00d7 ${i.quantity}`).join(", ")}</p>
              {a.note && <p className="text-muted-foreground italic">"{a.note}"</p>}
            </div>
            <p className="font-bold whitespace-nowrap">{formatNaira(role === "customer" ? a.customer_total : a.amount)}</p>
          </div>
          {a.status === "proposed" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {role === "customer" ? (
                <>
                  <Button size="sm" className="rounded-lg" disabled={busy === a.id || !publicKey} onClick={() => pay(a)}>
                    {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Approve &amp; pay {formatNaira(a.customer_total)}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" disabled={busy === a.id} onClick={() => respond(a, "decline")}>Decline</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy === a.id} onClick={() => respond(a, "withdraw")}>Withdraw</Button>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {canAdd && (
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Add-on
          </Button>
        )}
        {canReduce && (
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setReduceOpen(true)}>
            <MinusCircle className="h-4 w-4 mr-1" /> {role === "customer" ? "Change booking" : "Remove an item"}
          </Button>
        )}
      </div>
      {canReduce && <ReduceDialog open={reduceOpen} onClose={() => setReduceOpen(false)} booking={booking} role={role} onDone={refresh} />}
      {canAdd && <ProposeDialog open={open} onClose={() => setOpen(false)} booking={booking} onDone={refresh} />}
    </div>
  );
};

type Line = { name: string; quantity: string; unit_price: string };

const ProposeDialog = ({ open, onClose, booking, onDone }: { open: boolean; onClose: () => void; booking: any; onDone: () => void }) => {
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: "1", unit_price: "" }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: menu = [] } = useQuery({
    queryKey: ["my-service-items"],
    queryFn: () => api.serviceItems.getMine(),
    enabled: open,
  });
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const valid = lines.every((l) => l.name.trim() && Number(l.quantity) >= 1 && Number(l.unit_price) > 0);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setBusy(true);
    try {
      await api.bookings.proposeAddon(booking.id, lines.map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity), unit_price: Number(l.unit_price) })), note.trim() || undefined);
      toast.success("Add-on sent. The customer will approve and pay from their booking.");
      onDone(); onClose();
      setLines([{ name: "", quantity: "1", unit_price: "" }]); setNote("");
    } catch (e) { toast.error(err(e, "Couldn't send the add-on.")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Send an add-on</DialogTitle>
          <DialogDescription>Price the extras. The customer approves and pays; the money is held with the booking.</DialogDescription>
        </DialogHeader>
        {(menu as any[]).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(menu as any[]).slice(0, 8).map((m: any) => (
              <button key={m.id} type="button" className="text-xs rounded-full border border-border px-2.5 py-1 hover:border-primary/50"
                onClick={() => setLines((ls) => [...ls.filter((l) => l.name || l.unit_price), { name: m.name, quantity: "1", unit_price: String(m.unit_price) }])}>
                + {m.name} · {formatNaira(m.unit_price)}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_110px_32px] gap-2 items-center">
              <Input placeholder="Item" value={l.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Item name" />
              <Input inputMode="numeric" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value.replace(/\D/g, "") })} aria-label="Quantity" />
              <Input inputMode="numeric" placeholder="₦ each" value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Price each" />
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove line" disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { name: "", quantity: "1", unit_price: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Another item
          </Button>
        </div>
        <Textarea rows={2} placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-sm">Your price: <b>{formatNaira(total)}</b> <span className="text-muted-foreground">· the customer also pays the 2.5% platform fee</span></p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !valid}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Send add-on</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddonsPanel;

const ReduceDialog = ({ open, onClose, booking, role, onDone }: { open: boolean; onClose: () => void; booking: any; role: "customer" | "vendor"; onDone: () => void }) => {
  const items: any[] = booking.service_items_snapshot || [];
  const [remove, setRemove] = useState<Record<number, number>>({});
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const lines = Object.entries(remove).filter(([, q]) => q > 0).map(([i, q]) => ({ index: Number(i), quantity: q }));

  const check = async (next: Record<number, number>) => {
    setRemove(next);
    const ls = Object.entries(next).filter(([, q]) => q > 0).map(([i, q]) => ({ index: Number(i), quantity: q }));
    if (!ls.length) return setPreview(null);
    try { setPreview(await api.bookings.reductionPreview(booking.id, ls)); }
    catch (e) { setPreview({ error: err(e, "That change isn't possible.") }); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.bookings.reduce(booking.id, lines, reason.trim() || undefined);
      toast.success(r.refund_amount > 0 ? `Booking updated. ${formatNaira(r.refund_amount)} is on its way back to the customer.` : "Booking updated.");
      onDone(); onClose(); setRemove({}); setPreview(null); setReason("");
    } catch (e) { toast.error(err(e, "Couldn't update the booking.")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{role === "customer" ? "Reduce your booking" : "Remove an item"}</DialogTitle>
          <DialogDescription>
            {role === "customer" ? "Fewer guests or something you no longer need? Choose what to remove and see the refund before you confirm."
              : "Can't supply something? The customer is refunded the removed part in full. It's noted on your reliability record, and counts as a strike within 48 hours of the event."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.name}</p>
                <p className="text-xs text-muted-foreground">Booked: {it.quantity} · {formatNaira(it.unit_price)} each</p>
              </div>
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">Remove
                <Input inputMode="numeric" className="w-16 h-9 text-center" value={remove[i] || ""}
                  onChange={(e) => check({ ...remove, [i]: Math.min(Number(e.target.value.replace(/\D/g, "") || 0), it.quantity) })} />
              </label>
            </div>
          ))}
        </div>
        {preview?.error ? (
          <p className="text-sm text-destructive">{preview.error}</p>
        ) : preview ? (
          <div className="rounded-xl bg-muted/40 border border-border p-3 text-sm space-y-1">
            <p className="flex justify-between"><span>Removed</span><b>{formatNaira(preview.amount_removed)}</b></p>
            <p className="flex justify-between"><span>Refund to customer</span><b className="text-celebrate-emerald">{formatNaira(preview.refund_amount)}</b></p>
            {preview.vendor_keeps > 0 && <p className="flex justify-between text-muted-foreground"><span>Vendor keeps for preparation</span><span>{formatNaira(preview.vendor_keeps)}</span></p>}
            <p className="text-xs text-muted-foreground pt-1">{preview.reason}</p>
          </div>
        ) : null}
        <Textarea rows={2} placeholder={role === "vendor" ? "Why are you removing this? (required, shared with the customer)" : "Reason (optional, shared in chat)"}
          value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep as is</Button>
          <Button onClick={submit} disabled={busy || !lines.length || !preview || preview.error || (role === "vendor" && reason.trim().length < 5)}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirm change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
