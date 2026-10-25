import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, CheckCircle2, Loader2, CreditCard, Plus, Minus, Package, MapPin, ChevronLeft, ChevronRight, ShieldCheck, Pencil } from "lucide-react";
import { cn, formatNaira } from "@/lib/utils";
import BookingSuccess from "@/components/common/BookingSuccess";
import TimePicker from "@/components/common/TimePicker";
import { track } from "@/lib/analytics";
import { NIGERIAN_STATES } from "@/lib/categories";
import { useNavigate } from "react-router-dom";
import { PolicySummary, usePolicies } from "@/components/common/CancellationPolicy";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePaystackPayment } from "react-paystack";

interface ServiceItem {
    id: number;
    name: string;
    description?: string;
    unit_price: number;
    unit_label: string;
    pricing_type?: "unit" | "package" | "quote";
    min_quantity?: number;
    max_quantity?: number | null;
    included?: string[] | null;
}

interface CartEntry {
    item: ServiceItem;
    quantity: number;
    note?: string;
}

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendor: {
        id: number;
        business_name: string;
        starting_price: number | string;
        category?: string;
        logistics_fee?: number | string | null;
    };
    eventId?: number;
}

const BookingModal = ({ isOpen, onClose, vendor, eventId }: BookingModalProps) => {
    const { user } = useAuth();
    const [date, setDate] = useState<Date>();
    const [time, setTime] = useState("");
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [cart, setCart] = useState<Map<number, CartEntry>>(new Map());
    const [venueName, setVenueName] = useState("");
    const [city, setCity] = useState("");
    const [eventState, setEventState] = useState("");
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [step, setStep] = useState(0);
    const [booked, setBooked] = useState<{
        id: number; total: number; whenLabel: string; venueLabel?: string;
    } | null>(null);
    // True while the Paystack window is open: the form is closed for it, but its details are kept
    const paying = useRef(false);
    const pendingSummary = useRef<{ whenLabel: string; venueLabel?: string; total: number } | null>(null);

    const resetForm = () => {
        setDate(undefined);
        setTime("");
        setNotes("");
        setIsProcessing(false);
        setCart(new Map());
        setVenueName("");
        setCity("");
        setEventState("");
        setDeliveryInstructions("");
        setStep(0);
    };

    const queryClient = useQueryClient();
    const { data: policies } = usePolicies();
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";
    const initializePayment = usePaystackPayment({ publicKey, email: user?.email || "", amount: 0 });

    // Fetch vendor's service items (public, no auth needed)
    const { data: serviceItems = [] } = useQuery<ServiceItem[]>({
        queryKey: ["service-items", vendor.id],
        queryFn: () => api.serviceItems.getForVendor(vendor.id),
        enabled: isOpen,
        staleTime: 60_000,
    });

    const hasItems = serviceItems.length > 0;

    // Prices come from the server quote — the UI never computes totals itself.
    const itemsPayload = useMemo(
        () =>
            Array.from(cart.values()).map((e) => ({
                service_item_id: e.item.id,
                quantity: e.quantity,
                ...(e.note?.trim() ? { note: e.note.trim() } : {}),
            })),
        [cart],
    );

    const {
        data: quote,
        isFetching: quoteLoading,
        isError: quoteError,
        error: quoteErr,
    } = useQuery({
        queryKey: ["booking-quote", vendor.id, itemsPayload, eventState],
        queryFn: () =>
            api.bookings.quote({
                vendor_id: vendor.id,
                service_items: itemsPayload.length ? itemsPayload : undefined,
                event_state: eventState || undefined,
            } as any),
        retry: false,
        // Vendors with a price list need at least one item picked before there's a price
        enabled: isOpen && (!hasItems || itemsPayload.length > 0),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    const naira = (n: number | undefined) => formatNaira(n ?? 0);
    const quoteMessage = (quoteErr as any)?.response?.data?.detail;
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");
    const [phoneSaved, setPhoneSaved] = useState(false);
    const needsPhone = !!user && !user.phone_number && !phoneSaved;
    const phoneValid = /^(\+?234|0)[789][01]\d{8}$/.test(phone.replace(/\s/g, ""));

    // Booking for one of the customer's events: never before that event's date
    const { data: parentEvent } = useQuery({
        queryKey: ["event", eventId],
        queryFn: () => api.events.getById(eventId as number),
        enabled: isOpen && !!eventId,
    });
    const eventDay = parentEvent?.date ? new Date(`${parentEvent.date}T00:00:00`) : undefined;
    // Days this vendor can't take (blocked or fully booked), for the next 12 months
    const { data: availability } = useQuery({
        queryKey: ["vendor-availability", vendor.id],
        queryFn: () => {
            const start = new Date(), end = new Date(); end.setFullYear(end.getFullYear() + 1);
            return api.vendors.availability(vendor.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
        },
        enabled: isOpen,
        staleTime: 60_000,
    });
    const unavailable = new Set(availability?.unavailable || []);
    const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    useEffect(() => {
        if (eventDay && !date) setDate(eventDay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parentEvent?.date]);

    // Reset everything when modal closes
    useEffect(() => {
        // Keep the details while Paystack is open, so closing it without paying loses nothing
        if (!isOpen && !paying.current) resetForm();
    }, [isOpen]);

    const setQuantity = (item: ServiceItem, qty: number) => {
        const min = item.min_quantity || 1, max = item.max_quantity || 10000;
        setCart((prev) => {
            const next = new Map(prev);
            if (qty <= 0 || qty < min && (prev.get(item.id)?.quantity ?? 0) <= min && qty < (prev.get(item.id)?.quantity ?? 0)) {
                next.delete(item.id);
            } else {
                next.set(item.id, { item, quantity: Math.min(Math.max(qty, min), max), note: prev.get(item.id)?.note });
            }
            return next;
        });
    };
    useEffect(() => {
        if (cart.size) track("service_added", { vendor_id: vendor.id, items: cart.size });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.size]);
    const setNote = (item: ServiceItem, note: string) =>
        setCart((prev) => {
            const next = new Map(prev);
            const e = next.get(item.id);
            if (e) next.set(item.id, { ...e, note });
            return next;
        });

    const getQty = (itemId: number) => cart.get(itemId)?.quantity ?? 0;

    const confirmPayment = async (bookingId: number, paystackRef?: string) => {
        setIsProcessing(true);
        try {
            const confirmed = await api.bookings.verifyPayment(bookingId, paystackRef);
            track("payment_succeeded", { vendor_id: vendor.id, booking_id: bookingId });
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            const summary = pendingSummary.current;
            paying.current = false;
            resetForm();
            setBooked({
                id: bookingId,
                total: Number(confirmed?.price ?? summary?.total ?? 0),
                whenLabel: summary?.whenLabel ?? "your event",
                venueLabel: summary?.venueLabel,
            });
        } catch (error: any) {
            paying.current = false;
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 502) {
                // Paystack couldn't be reached — the webhook will finish the job.
                toast.info(detail || "Payment received. Your booking will appear in your dashboard shortly.");
                onClose();
            } else {
                toast.error(typeof detail === "string" ? detail : "We couldn't confirm your payment. Please contact support.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePay = async () => {
        if (!date || !quote) return;
        setIsProcessing(true);
        try {
            if (needsPhone) {
                // Saved to the profile: the vendor gets it once they reconfirm, for coordination on the day
                await api.auth.updateMe({ phone_number: phone });
                setPhoneSaved(true);
            }
            // Send the event time with the user's UTC offset so it isn't misread as UTC.
            const [hh, mm] = (time || "12:00").split(":").map(Number);
            const eventLocal = new Date(date);
            eventLocal.setHours(hh, mm, 0, 0);
            const hasAddress = venueName.trim() || city.trim() || eventState.trim();

            track("checkout_started", { vendor_id: vendor.id, total: quote.customer_total });
            const checkout = await api.bookings.create({
                vendor_id: vendor.id,
                event_id: eventId,
                event_date: format(eventLocal, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                event_time: time || undefined,
                notes: notes.trim() || undefined,
                service_items: itemsPayload.length ? itemsPayload : undefined,
                event_address: hasAddress ? {
                    venue_name: venueName.trim() || undefined,
                    city: city.trim() || undefined,
                    state: eventState.trim() || undefined,
                    delivery_instructions: deliveryInstructions.trim() || undefined,
                } : undefined,
            });

            setIsProcessing(false);
            pendingSummary.current = {
                whenLabel: format(eventLocal, "EEE d MMM") + (time ? `, ${time}` : ""),
                venueLabel: [venueName.trim(), city.trim()].filter(Boolean).join(", ") || undefined,
                total: checkout.customer_total,
            };
            // Paystack opens its own window; close ours first so the two don't fight over focus.
            paying.current = true;
            onClose();
            initializePayment({
                config: {
                    email: checkout.email,
                    amount: checkout.amount_kobo,
                    reference: checkout.reference,
                    currency: checkout.currency,
                },
                onSuccess: (res: any) => confirmPayment(checkout.booking_id, res?.reference),
                onClose: () => {
                    paying.current = false;
                    toast.info("Payment window closed — you haven't been charged. Tap Book again to pick up where you left off.");
                },
            });
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            toast.error(typeof detail === "string" ? detail : "Couldn't start checkout. Please try again.");
            setIsProcessing(false);
        }
    };

    const needsItems = hasItems && itemsPayload.length === 0;
    const isValid = date && user && quote && !quoteError && !needsItems;

    // ── Steps ────────────────────────────────────────────────────────────────
    const steps = hasItems ? ["Services", "Details", "Review & pay"] : ["Details", "Review & pay"];
    const stepName = steps[Math.min(step, steps.length - 1)];
    const isLast = step >= steps.length - 1;
    const canAdvance = stepName === "Services" ? itemsPayload.length > 0
        : stepName === "Details" ? !!date && (!needsPhone || phoneValid) : true;
    const advanceHint = stepName === "Services" ? "Choose at least one service" : stepName === "Details" ? "Pick your event date" : "";
    const itemCount = itemsPayload.reduce((sum, i) => sum + i.quantity, 0);
    const goTo = (name: string) => setStep(Math.max(0, steps.indexOf(name)));

    const venueSummary = [venueName.trim(), city.trim(), eventState.trim()].filter(Boolean).join(", ");

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
            <DialogContent
                className={cn(
                    "flex flex-col gap-0 p-0 overflow-hidden bg-white",
                    // Phone: full-screen sheet. Larger screens: centred card.
                    "w-full max-w-full h-[100dvh] max-h-[100dvh] rounded-none border-0",
                    "sm:h-auto sm:max-h-[90vh] sm:max-w-[560px] sm:rounded-2xl sm:border",
                )}
            >
                {/* Header + progress */}
                <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/70 flex-shrink-0">
                    <DialogHeader className="text-left space-y-1 pr-8">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                            Book {vendor.business_name}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            Step {step + 1} of {steps.length} · {stepName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-3 flex gap-1.5" aria-hidden>
                        {steps.map((s, i) => (
                            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-muted")} />
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div key={stepName} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 animate-in fade-in-0 slide-in-from-right-2 duration-200">
                    {stepName === "Services" && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">Choose what you need. You only pay for what you select.</p>
                            <div className="space-y-2">
                                {serviceItems.map((item) => {
                                    const qty = getQty(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                "flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                                                qty > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-white",
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground leading-snug">{item.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {item.pricing_type === "quote" ? (
                                                        <span className="font-semibold text-foreground/80">Price on request</span>
                                                    ) : item.pricing_type === "package" ? (
                                                        <><span className="font-semibold text-foreground/80">{formatNaira(item.unit_price)}</span> · package</>
                                                    ) : (
                                                        <><span className="font-semibold text-foreground/80">{formatNaira(item.unit_price)}</span> / {item.unit_label}
                                                        {(item.min_quantity || 1) > 1 && <> · min {item.min_quantity}</>}{item.max_quantity ? <> · max {item.max_quantity}</> : null}</>
                                                    )}
                                                </p>
                                                {item.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{item.description}</p>}
                                                {!!item.included?.length && (
                                                    <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                                        {item.included.map((x) => <li key={x}>{x}</li>)}
                                                    </ul>
                                                )}
                                                {qty > 0 && (
                                                    <input
                                                        value={cart.get(item.id)?.note || ""}
                                                        onChange={(e) => setNote(item, e.target.value.slice(0, 500))}
                                                        placeholder="Details for the vendor (optional): flavour, colours, theme…"
                                                        className="mt-2 w-full h-9 rounded-lg border border-input bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                        aria-label={`Details for ${item.name}`}
                                                    />
                                                )}
                                            </div>
                                            {item.pricing_type === "quote" ? (
                                                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg px-3 flex-shrink-0"
                                                    onClick={() => { onClose(); navigate(`/messages?vendor=${vendor.id}`); }}>
                                                    Ask for a quote
                                                </Button>
                                            ) : item.pricing_type === "package" ? (
                                                <Button type="button" variant={qty ? "default" : "outline"} size="sm" className="h-9 rounded-lg px-3 flex-shrink-0"
                                                    onClick={() => setQuantity(item, qty ? 0 : 1)}>
                                                    {qty ? "Selected \u2713" : "Choose"}
                                                </Button>
                                            ) : qty === 0 ? (
                                                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg px-3 flex-shrink-0" onClick={() => setQuantity(item, item.min_quantity || 1)}>
                                                    <Plus className="h-4 w-4 mr-1" /> Add
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setQuantity(item, qty - 1)} aria-label={`Remove one ${item.name}`}>
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={0}
                                                        max={10000}
                                                        value={qty}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            if (e.target.value === "") setQuantity(item, 0);
                                                            else if (!isNaN(val) && val >= 0 && val <= 10000) setQuantity(item, val);
                                                        }}
                                                        aria-label={`${item.name} quantity`}
                                                        className="w-12 h-9 text-center text-sm font-semibold tabular-nums border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                                                    />
                                                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setQuantity(item, qty + 1)} aria-label={`Add one ${item.name}`}>
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {stepName === "Details" && (
                        <>
                            <div className="space-y-2">
                                <Label>When is your event? <span className="text-destructive">*</span></Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn("w-full h-11 justify-start text-left font-normal rounded-xl", !date && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "EEEE, d MMMM yyyy") : "Pick a date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-white" align="start">
                                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus defaultMonth={date ?? eventDay}
                                            disabled={(d) => d <= new Date() || (!!eventDay && d < eventDay) || unavailable.has(isoDay(d))} />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label>Start time <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                                <TimePicker value={time} onChange={setTime} />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" /> Where? <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                                </Label>
                                <Input placeholder="Venue or event hall" value={venueName} onChange={(e) => setVenueName(e.target.value)} className="h-11 rounded-xl bg-white border-input" />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-xl bg-white border-input" />
                                    <select value={eventState} onChange={(e) => setEventState(e.target.value)} aria-label="State"
                                        className={cn("h-11 rounded-xl bg-white border border-input px-3 text-sm", !eventState && "text-muted-foreground")}>
                                        <option value="">State</option>
                                        {NIGERIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                                    </select>
                                </div>
                                <Input placeholder="Delivery or access instructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className="h-11 rounded-xl bg-white border-input" />
                            </div>

                            {needsPhone && (
                                <div className="space-y-2">
                                    <Label>Your phone number <span className="text-destructive">*</span></Label>
                                    <Input inputMode="tel" placeholder="0803 123 4567" value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))}
                                        className="h-11 rounded-xl bg-white border-input" />
                                    <p className="text-xs text-muted-foreground">Shared with the vendor once they reconfirm, so you can coordinate on the day. Saved to your profile.</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Anything the vendor should know? <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                                <Textarea
                                    placeholder="Theme, guest count, special requests…"
                                    className="resize-none min-h-[88px] rounded-xl bg-white border-input"
                                    maxLength={2000}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {stepName === "Review & pay" && (
                        <>
                            {/* What they're booking — with quick edits */}
                            <div className="rounded-xl border border-border divide-y divide-border">
                                <ReviewRow
                                    label="Date"
                                    value={date ? `${format(date, "EEE d MMM yyyy")}${time ? ` · ${time}` : ""}` : "—"}
                                    onEdit={() => goTo("Details")}
                                />
                                <ReviewRow label="Venue" value={venueSummary || "Not added"} muted={!venueSummary} onEdit={() => goTo("Details")} />
                                {hasItems && (
                                    <ReviewRow
                                        label="Services"
                                        value={`${itemCount} item${itemCount === 1 ? "" : "s"}`}
                                        onEdit={() => goTo("Services")}
                                    />
                                )}
                            </div>

                            {/* Price — every figure comes from the server quote */}
                            <div className={cn("rounded-xl bg-muted/40 border border-border p-4 space-y-2 transition-opacity", quoteLoading && "opacity-60")}>
                                {quoteError ? (
                                    <p className="text-sm text-destructive">{typeof quoteMessage === "string" ? quoteMessage : "Couldn't load pricing. Please go back and try again."}</p>
                                ) : !quote ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating price…
                                    </div>
                                ) : (
                                    <>
                                        {quote.base_price > 0 && <PriceRow label="Service rate" value={naira(quote.base_price)} />}
                                        {quote.items.map((line) => (
                                            <PriceRow key={line.service_item_id} label={`${line.name} × ${line.quantity}`} value={naira(line.subtotal)} />
                                        ))}
                                        {quote.logistics_fee > 0 && <PriceRow label={(quote as any).delivery_note || "Logistics"} value={naira(quote.logistics_fee)} muted />}
                                        <PriceRow label={`Platform fee (${+(quote.platform_fee_rate * 100).toFixed(2)}%)`} value={naira(quote.platform_fee)} muted />
                                        <div className="flex justify-between items-baseline border-t border-border pt-2.5 mt-1">
                                            <span className="font-semibold">Total</span>
                                            <span className="text-xl font-bold text-primary">{naira(quote.customer_total)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <PolicySummary policyKey={(vendor as any).cancellation_policy} eventDate={date} compact />
                            <p className="text-xs text-muted-foreground -mt-2 px-1">
                                By tapping Pay now you agree to {vendor.business_name}'s {policies?.[(vendor as any).cancellation_policy || "standard"]?.label ?? "Standard"} cancellation policy above.
                            </p>

                            {quote && (quote as any).advance_amount > 0 && (
                                <div className="rounded-xl bg-[hsl(var(--primary-pale))] border border-[hsl(var(--primary-light))] px-4 py-3 text-xs leading-relaxed">
                                    <p className="font-semibold text-sm text-foreground mb-0.5">Preparation advance: {naira((quote as any).advance_amount)}</p>
                                    {vendor.business_name} receives this up to 3 days before your event, once they've reconfirmed, to buy supplies and cover logistics.
                                    The rest stays held until you confirm the service. If they cancel or don't show, you still get every naira back.
                                </div>
                            )}

                            <div className="flex gap-3 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                                <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs leading-relaxed text-green-900">
                                    Your payment is held safely and only released to the vendor after you confirm the service. If they decline, you're refunded in full.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer — always visible: running total + next action */}
                <div className="flex-shrink-0 border-t border-border bg-white px-5 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground leading-none mb-1">
                                {quote && !needsItems ? "Total" : hasItems ? "Nothing selected yet" : "Total"}
                            </p>
                            <p className="text-lg font-bold text-foreground leading-none truncate">
                                {quote && !needsItems ? naira(quote.customer_total) : quoteLoading ? "…" : "—"}
                            </p>
                        </div>
                        {step > 0 && (
                            <Button variant="ghost" className="h-11 px-3 rounded-xl" onClick={() => setStep(step - 1)} disabled={isProcessing}>
                                <ChevronLeft className="h-4 w-4 mr-0.5" /> Back
                            </Button>
                        )}
                        {!isLast ? (
                            <Button className="h-11 px-5 rounded-xl" disabled={!canAdvance} onClick={() => setStep(step + 1)} title={canAdvance ? undefined : advanceHint}>
                                {canAdvance ? "Continue" : advanceHint} {canAdvance && <ChevronRight className="h-4 w-4 ml-0.5" />}
                            </Button>
                        ) : !publicKey ? (
                            <Button disabled className="h-11 px-5 rounded-xl">Payments unavailable</Button>
                        ) : (
                            <Button
                                onClick={handlePay}
                                disabled={!isValid || isProcessing || quoteLoading}
                                className="h-11 px-5 rounded-xl shadow-lg hover:shadow-primary/25"
                            >
                                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Please wait…</> : <><CreditCard className="h-4 w-4 mr-2" /> Pay now</>}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* "You're booked!" — its own window, because the form closes while Paystack is open */}
        <Dialog open={!!booked} onOpenChange={(open) => !open && setBooked(null)}>
            <DialogContent
                className={cn(
                    "flex flex-col gap-0 p-0 overflow-hidden bg-background",
                    "w-full max-w-full h-[100dvh] max-h-[100dvh] rounded-none border-0",
                    "sm:h-[min(760px,90vh)] sm:max-w-[480px] sm:rounded-2xl sm:border",
                )}
            >
                <DialogTitle className="sr-only">Booking confirmed</DialogTitle>
                <DialogDescription className="sr-only">Your payment was received and the vendor has been notified.</DialogDescription>
                {booked && (
                    <BookingSuccess
                        bookingId={booked.id}
                        vendorName={vendor.business_name}
                        vendorId={vendor.id}
                        whenLabel={booked.whenLabel}
                        venueLabel={booked.venueLabel}
                        total={booked.total}
                        onDone={() => setBooked(null)}
                    />
                )}
            </DialogContent>
        </Dialog>
        </>
    );
};

const ReviewRow = ({ label, value, onEdit, muted }: { label: string; value: string; onEdit: () => void; muted?: boolean }) => (
    <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
        <span className={cn("text-sm flex-1 min-w-0 truncate", muted ? "text-muted-foreground" : "font-medium")}>{value}</span>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-primary flex items-center gap-1 hover:underline flex-shrink-0">
            <Pencil className="h-3 w-3" /> Edit
        </button>
    </div>
);

const PriceRow = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
    <div className={cn("flex justify-between gap-3 text-sm", muted && "text-muted-foreground")}>
        <span className="min-w-0">{label}</span>
        <span className={cn("flex-shrink-0 tabular-nums", !muted && "font-medium")}>{value}</span>
    </div>
);

export default BookingModal;
