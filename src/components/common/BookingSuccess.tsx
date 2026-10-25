import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/utils";

interface Props {
  bookingId: number;
  vendorName: string;
  vendorId: number;
  whenLabel: string;
  venueLabel?: string;
  total: number;
  onDone: () => void;
}

// Celebration colours: brand amber + the jewel tones, used only for moments like this.
const CONFETTI_COLORS = ["#E8770E", "#7A2E6E", "#0E8F6A", "#F2B33D", "#13213C"];

/** "You're booked!" — shown in the booking sheet right after payment is confirmed. */
export const BookingSuccess = ({ bookingId, vendorName, vendorId, whenLabel, venueLabel, total, onDone }: Props) => {
  const navigate = useNavigate();

  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: `${(i * 29) % 100}%`,
        width: i % 3 === 0 ? 6 : 10,
        height: i % 3 === 0 ? 14 : 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        style: {
          "--delay": `${(i % 10) * 0.08}s`,
          "--dur": `${2.2 + (i % 5) * 0.25}s`,
          "--drift": `${((i * 37) % 80) - 40}px`,
          "--spin": `${360 + ((i * 53) % 360)}deg`,
        } as React.CSSProperties,
      })),
    [],
  );

  const share = async () => {
    const url = `${window.location.origin}/vendors/${vendorId}`;
    const text = `We've booked ${vendorName} for ${whenLabel} on Plagohive!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "We're booked!", text, url });
        return;
      }
    } catch {
      return; // user closed the share sheet
    }
    // No native share (most desktops): WhatsApp is how families plan events
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  };

  const receipt = () =>
    api.documents.download(bookingId, "receipt").catch(() =>
      toast.error("Your receipt is still being prepared — it's also in your email."),
    );

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{ left: p.left, width: p.width, height: p.height, background: p.color, ...p.style }}
          />
        ))}
      </div>

      <div className="relative flex-1 overflow-y-auto px-6 pt-12 pb-6 text-center">
        <div className="animate-pop-in mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-accent shadow-[0_0_0_10px_hsl(var(--primary-light))]">
          <Check className="h-10 w-10 text-white" strokeWidth={3} aria-hidden />
        </div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">You're booked!</h2>
        <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
          We've told {vendorName}. You'll get an email the moment they accept.
        </p>

        <div className="mx-auto mt-6 max-w-[380px] overflow-hidden rounded-[22px] border border-border bg-white text-left shadow-[var(--shadow-lg)]">
          <div className="px-4 py-3.5">
            <p className="font-semibold text-foreground">{vendorName}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {whenLabel}
              {venueLabel ? ` · ${venueLabel}` : ""}
            </p>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Paid · held safely</span>
            <span className="font-display text-xl font-extrabold text-foreground">{formatNaira(total)}</span>
          </div>
        </div>

        <ol className="mx-auto mt-5 max-w-[380px] space-y-2.5 text-left text-sm">
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-navy-foreground">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            Payment received
          </li>
          <li className="flex items-center gap-3 font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent text-xs text-[hsl(var(--primary-deep))]">2</span>
            {vendorName} accepts
          </li>
          <li className="flex items-center gap-3 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border text-xs">3</span>
            Your event — then you confirm, and they get paid
          </li>
        </ol>
      </div>

      <div className="relative flex-shrink-0 space-y-2.5 border-t border-border bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          className="h-12 w-full rounded-2xl bg-navy text-[15px] font-bold text-navy-foreground hover:bg-navy/90"
          onClick={() => { onDone(); navigate("/customer-dashboard"); }}
        >
          View my booking
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="h-11 rounded-2xl border-celebrate/30 font-semibold text-celebrate hover:bg-celebrate/5" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" aria-hidden /> Share with family
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl font-semibold" onClick={receipt}>
            <FileText className="mr-2 h-4 w-4" aria-hidden /> Receipt
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccess;
