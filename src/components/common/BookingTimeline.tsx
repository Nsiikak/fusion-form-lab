import { Check, Clock, Scale, Undo2 } from "lucide-react";
import { cn, formatNaira } from "@/lib/utils";

interface Props {
  booking: {
    status: string;
    payout_status?: string;
    refund_status?: string;
    resolution?: string | null;
    cancelled_by?: string | null;
    refund_amount?: number | null;
  };
  role: "customer" | "vendor";
  className?: string;
}

const STEPS = {
  customer: ["Paid", "Vendor accepted", "Service delivered", "Completed"],
  vendor: ["Booked & paid", "You accepted", "Service delivered", "Payout sent"],
};

/** Where the booking is in its journey: index of the step currently in progress
 *  (steps before it are done). Returns STEPS.length when everything is done. */
function currentStep(b: Props["booking"], role: Props["role"]): number {
  switch (b.status) {
    case "pending":
      return 1;
    case "confirmed":
      return 2;
    case "awaiting_confirmation":
    case "disputed":
      return 3;
    case "completed":
      if (role === "vendor" && b.payout_status !== "paid") return 3;
      return 4;
    default:
      return 0;
  }
}

/** One short line on what happens next — the question people actually have. */
function nextLine(b: Props["booking"], role: Props["role"]): string | null {
  const c = role === "customer";
  switch (b.status) {
    case "pending":
      return c ? "Waiting for the vendor to accept. If they decline, you're refunded in full." : "Accept or decline this request.";
    case "confirmed":
      return c ? "Your payment is held safely until the event is done." : "After the event, mark the service as complete.";
    case "awaiting_confirmation":
      return c ? "Please confirm the service went well to release payment." : "Waiting for the customer to confirm. Payment auto-releases after 24 hours.";
    case "disputed":
      return c ? "Our team is reviewing your report. Payment is on hold." : "The customer reported a problem. Payout is on hold while we review.";
    case "completed":
      if (c) return null;
      return {
        awaiting_approval: "Payout is being reviewed — usually within 1 working day.",
        processing: "Payout is on its way to your bank account.",
        awaiting_otp: "Payout is on its way to your bank account.",
        failed: "Payout is delayed — our team is on it.",
        paid: null,
      }[b.payout_status || ""] ?? null;
    default:
      return null;
  }
}

const REFUND_TEXT: Record<string, string> = {
  processing: "refund on its way",
  needs_details: "add a refund account below to receive your refund",
  refunded: "refunded",
  pending_review: "refund under review",
  failed: "refund delayed — our team is on it",
  declined: "no refund",
};

export const BookingTimeline = ({ booking, role, className }: Props) => {
  // Ended without completing: one calm line instead of a broken timeline
  if (booking.status === "cancelled" || booking.status === "declined") {
    const refund = booking.refund_status && booking.refund_status !== "none" ? REFUND_TEXT[booking.refund_status] : null;
    const amount = booking.refund_amount ? formatNaira(booking.refund_amount) : null;
    const who =
      booking.cancelled_by === "system" ? "The vendor didn't respond in time"
      : booking.status === "declined" ? "Declined by the vendor"
      : booking.cancelled_by === "vendor" ? (role === "customer" ? "The vendor cancelled" : "You cancelled this booking")
      : booking.cancelled_by === "customer" ? (role === "customer" ? "You cancelled" : "The customer cancelled")
      : "Cancelled";
    const money = role === "customer"
      ? (refund ? ` · ${amount && booking.refund_status !== "pending_review" ? `${amount} ` : ""}${refund}` : "")
      : "";
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2", className)}>
        <Undo2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{who}{money}</span>
      </div>
    );
  }
  if (booking.status === "awaiting_payment") return null;

  const steps = STEPS[role];
  const current = currentStep(booking, role);
  const disputed = booking.status === "disputed";
  const note = nextLine(booking, role);

  return (
    <div className={cn("space-y-2.5", className)}>
      <ol className="grid grid-cols-4 gap-1" aria-label="Booking progress">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const warn = active && disputed;
          return (
            <li key={label} className="relative flex flex-col items-center text-center">
              {/* connector to the previous step */}
              {i > 0 && (
                <span
                  className={cn(
                    "absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2",
                    i <= current ? "bg-primary/60" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-primary bg-primary text-white",
                  active && !warn && "border-primary bg-white text-primary",
                  warn && "border-amber-500 bg-amber-50 text-amber-600",
                  !done && !active && "border-border bg-white text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : warn ? (
                  <Scale className="h-3 w-3" />
                ) : active ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                )}
              </span>
              <span
                className={cn(
                  "mt-1.5 text-[10.5px] sm:text-xs leading-tight",
                  done ? "text-foreground" : active ? (warn ? "text-amber-700 font-semibold" : "text-primary font-semibold") : "text-muted-foreground",
                )}
              >
                {warn ? "Under review" : label}
              </span>
            </li>
          );
        })}
      </ol>
      {note && (
        <p className={cn("text-xs leading-relaxed rounded-xl px-3 py-2", disputed ? "bg-amber-50 text-amber-800" : "bg-primary/5 text-foreground/80")}>
          {note}
        </p>
      )}
    </div>
  );
};

export default BookingTimeline;
