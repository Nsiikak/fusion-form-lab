import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

const MIN_LENGTH = 10;

interface Props {
  booking: { id: number; vendor_name?: string; status: string } | null;
  onClose: () => void;
  onReported: () => void;
}

const ReportProblemDialog = ({ booking, onClose, onReported }: Props) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!booking) setReason("");
  }, [booking]);

  const noShow = booking?.status === "confirmed";

  const submit = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await api.bookings.openDispute(booking.id, reason.trim(), noShow);
      toast.success("Thanks — we've put the payment on hold and our team will be in touch.");
      onReported();
      onClose();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Couldn't send your report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            {noShow ? "Report a no-show" : "Report a problem"}
          </DialogTitle>
          <DialogDescription>
            {noShow
              ? `We'll ask ${booking?.vendor_name || "the vendor"} to respond within 24 hours. If they don't, you're refunded in full automatically — and we'll help you find a replacement.`
              : `We'll hold the payment to ${booking?.vendor_name || "the vendor"} while our team looks into it, hear from both sides, then refund you or release the payment. Most cases are settled within 2 working days.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="dispute-reason">What went wrong?</Label>
          <Textarea
            id="dispute-reason"
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder={
              noShow
                ? "e.g. The vendor didn't arrive at the venue and stopped answering calls from 2pm."
                : "e.g. We ordered 10 trays of jollof but only 6 were delivered, and they arrived 2 hours late."
            }
          />
          <p className="text-xs text-muted-foreground">
            Be as specific as you can — what was agreed, what happened, and when. You can send photos by replying
            to the email we'll send you.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={busy || reason.trim().length < MIN_LENGTH}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblemDialog;
