import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, CancellationPreview } from "@/lib/api";
import { cn, formatNaira } from "@/lib/utils";

const errorText = (e: any, fallback: string) =>
  typeof e?.response?.data?.detail === "string" ? e.response.data.detail : fallback;

interface BookingLite { id: number; vendor_name?: string; customer_name?: string; price?: number }

// ── Customer: cancel with an honest preview ─────────────────────────────────

export const CancelBookingDialog = ({ booking, onClose, onDone }: { booking: BookingLite | null; onClose: () => void; onDone: () => void }) => {
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [mode, setMode] = useState<"policy" | "review">("policy");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreview(null); setMode("policy"); setReason("");
    if (booking) api.bookings.cancellationPreview(booking.id).then(setPreview).catch(() => toast.error("Couldn't load refund details."));
  }, [booking]);

  const submit = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await api.bookings.cancel(booking.id, reason.trim() || undefined, mode === "review");
      toast.success(mode === "review"
        ? "Cancelled. Our team will review your refund and email you within 2 working days."
        : preview && preview.refund_amount > 0
          ? `Cancelled. ${formatNaira(preview.refund_amount)} is on its way back to you.`
          : "Booking cancelled.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, "Couldn't cancel. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const partial = preview && !preview.full_refund;

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Cancel your booking?</DialogTitle>
          <DialogDescription>
            {booking?.vendor_name ? `With ${booking.vendor_name}. ` : ""}Here's exactly what happens to your money.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto my-6 text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            {mode === "policy" ? (
              <div className={cn("rounded-2xl border p-4 text-center", preview.refund_amount > 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50")}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You'll get back</p>
                <p className="font-display text-3xl font-extrabold mt-1">{formatNaira(preview.refund_amount)}</p>
                <p className="text-sm mt-2 text-foreground/80">{preview.reason}</p>
                {partial && preview.policy && (
                  <p className="text-xs text-muted-foreground mt-2">{preview.policy.label} policy: {preview.policy.summary}</p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                <p className="font-semibold">Ask us to review your refund</p>
                <p className="text-muted-foreground mt-1">
                  For serious situations like a bereavement, illness or a venue problem. Your booking is cancelled now and our team
                  decides the refund fairly, usually within 2 working days.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">{mode === "review" ? "What happened?" : "Reason (optional)"}</Label>
              <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl"
                placeholder={mode === "review" ? "Tell us briefly — it helps us decide quickly." : "e.g. The date changed"} />
            </div>

            {partial && (
              <button type="button" onClick={() => setMode(mode === "policy" ? "review" : "policy")} className="text-sm font-medium text-primary hover:underline">
                {mode === "policy" ? "Something serious happened? Ask for a review instead" : "Back to the standard refund"}
              </button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep booking</Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !preview || (mode === "review" && reason.trim().length < 10)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === "review" ? "Cancel & request review" : "Cancel booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Vendor: cancel an accepted booking ───────────────────────────────────────

export const VendorCancelDialog = ({ booking, onClose, onDone }: { booking: BookingLite | null; onClose: () => void; onDone: () => void }) => {
  const [fee, setFee] = useState<{ fee: number; severity: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFee(null); setReason("");
    if (booking) api.bookings.vendorCancelPreview(booking.id).then(setFee).catch(() => setFee({ fee: 0, severity: "logged" }));
  }, [booking]);

  const submit = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await api.bookings.vendorCancel(booking.id, reason.trim());
      toast.success("Booking cancelled. The customer has been refunded and notified.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, "Couldn't cancel. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Cancel this booking?</DialogTitle>
          <DialogDescription>
            {booking?.customer_name || "Your customer"} will get a full refund and help finding someone else.
          </DialogDescription>
        </DialogHeader>
        {!fee ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto my-4 text-muted-foreground" />
        ) : (
          <div className={cn("rounded-2xl border p-4 text-sm", fee.fee > 0 ? "border-red-200 bg-red-50" : "border-border bg-muted/40")}>
            {fee.fee > 0 ? (
              <>
                <p className="font-semibold text-red-800">Late-cancellation fee: {formatNaira(fee.fee)}</p>
                <p className="text-red-900/80 mt-1">
                  Deducted from your next payout{fee.severity === "severe" ? ", and your listing is paused for review" : ", and you'll get a strike (2 strikes in 90 days pause your listing)"}.
                </p>
              </>
            ) : (
              <p>No fee — you're giving more than 14 days' notice. This is noted on your account.</p>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="vendor-cancel-reason">Reason (shared with the customer)</Label>
          <Textarea id="vendor-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl"
            placeholder="e.g. Our van broke down and we can't get a replacement in time." />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep booking</Button>
          <Button variant="destructive" onClick={submit} disabled={busy || reason.trim().length < 5}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Vendor: answer a no-show report ─────────────────────────────────────────

export const NoShowResponseDialog = ({ booking, onClose, onDone }: { booking: (BookingLite & { response_due_at?: string | null }) | null; onClose: () => void; onDone: () => void }) => {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setMessage(""), [booking]);

  const submit = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await api.bookings.noShowResponse(booking.id, message.trim());
      toast.success("Thanks — our team will review both sides and decide.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, "Couldn't send your response."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>The customer says you didn't arrive</DialogTitle>
          <DialogDescription>
            If you were there, tell us now. Without a response the customer is refunded automatically
            {booking?.response_due_at ? ` at ${new Date(booking.response_due_at).toLocaleString("en-NG", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : " within 24 hours"}.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-celebrate-emerald" />
          Helpful evidence: photos from the venue, delivery confirmation, or messages with the customer. You can send photos in the chat.
        </div>
        <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="rounded-xl"
          placeholder="e.g. We arrived at 3pm and set up by 4. Photos are in the chat." />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button>
          <Button onClick={submit} disabled={busy || message.trim().length < 5}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
