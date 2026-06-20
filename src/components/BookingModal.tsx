import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, CheckCircle2, Loader2, CreditCard, Plus, Minus, Package, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PaystackButton } from "react-paystack";

interface ServiceItem {
    id: number;
    name: string;
    description?: string;
    unit_price: number;
    unit_label: string;
}

interface CartEntry {
    item: ServiceItem;
    quantity: number;
}

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendor: {
        id: number;
        business_name: string;
        starting_price: number | string;
        category?: string;
        service_fee_percentage?: number | string | null;
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

    const startingPrice = Number(vendor.starting_price);
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";

    // Fetch vendor's service items (public, no auth needed)
    const { data: serviceItems = [] } = useQuery<ServiceItem[]>({
        queryKey: ["service-items", vendor.id],
        queryFn: () => api.serviceItems.getForVendor(vendor.id),
        enabled: isOpen,
        staleTime: 60_000,
    });

    const hasItems = serviceItems.length > 0;

    // Base rate is always charged; service items are additive on top
    const cartTotal = Array.from(cart.values()).reduce(
        (sum, entry) => sum + Number(entry.item.unit_price) * entry.quantity,
        0,
    );
    const baseTotal = startingPrice + cartTotal;

    // Vendor-defined fees (set during vendor registration)
    const vendorServiceFeeRate = Number(vendor.service_fee_percentage ?? 0) / 100;
    const vendorServiceFee = vendorServiceFeeRate > 0 ? Math.round(baseTotal * vendorServiceFeeRate) : 0;
    const vendorLogisticsFee = Number(vendor.logistics_fee ?? 0);
    const vendorTotal = baseTotal + vendorServiceFee + vendorLogisticsFee;

    // 2.5% platform fee on top of vendor total
    const SERVICE_FEE_RATE = 0.025;
    const serviceFee = Math.round(vendorTotal * SERVICE_FEE_RATE);
    const grossTotal = vendorTotal + serviceFee;

    // Paystack expects kobo
    const paystackAmount = Math.round(grossTotal * 100);

    // Reset everything when modal closes
    useEffect(() => {
        if (!isOpen) {
            setDate(undefined);
            setTime("");
            setNotes("");
            setIsProcessing(false);
            setCart(new Map());
            setVenueName("");
            setCity("");
            setEventState("");
            setDeliveryInstructions("");
        }
    }, [isOpen]);

    const setQuantity = (item: ServiceItem, qty: number) => {
        setCart((prev) => {
            const next = new Map(prev);
            if (qty <= 0) {
                next.delete(item.id);
            } else {
                next.set(item.id, { item, quantity: qty });
            }
            return next;
        });
    };

    const getQty = (itemId: number) => cart.get(itemId)?.quantity ?? 0;

    const handleSuccess = async (reference: any) => {
        if (!date) return;
        setIsProcessing(true);
        try {
            const timeStr = time || "12:00";
            const eventDatetime = `${format(date, "yyyy-MM-dd")}T${timeStr}:00`;

            const serviceItemsPayload =
                hasItems && cart.size > 0
                    ? Array.from(cart.values()).map((e) => ({
                          service_item_id: e.item.id,
                          quantity: e.quantity,
                      }))
                    : undefined;

            const hasAddress = venueName.trim() || city.trim() || eventState.trim();
            await api.bookings.create({
                vendor_id: vendor.id,
                event_id: eventId,
                price: vendorTotal,
                event_date: eventDatetime,
                event_time: time || undefined,
                notes: notes.trim() || undefined,
                payment_reference: reference.reference,
                service_items: serviceItemsPayload,
                event_address: hasAddress ? {
                    venue_name: venueName.trim() || undefined,
                    city: city.trim() || undefined,
                    state: eventState.trim() || undefined,
                    delivery_instructions: deliveryInstructions.trim() || undefined,
                } : undefined,
            });

            toast.success("Booking confirmed! The vendor has been notified.");
            onClose();
        } catch (error: any) {
            const msg = error.response?.data?.detail;
            if (typeof msg === "string") {
                toast.error(`Booking failed: ${msg}`);
            } else {
                toast.error("Payment received but booking failed. Contact support with your payment reference.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePaystackClose = () => {
        toast.info("Payment window closed. Your booking was not completed.");
    };

    const paystackProps = {
        email: user?.email || "",
        amount: paystackAmount,
        publicKey,
        text: "Pay Now",
        onSuccess: handleSuccess,
        onClose: handlePaystackClose,
        reference: `bkg_${vendor.id}_${Date.now()}`,
    };

    const isValid = date && user;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[560px] bg-white/95 backdrop-blur-xl border-primary/20 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-primary">Book {vendor.business_name}</DialogTitle>
                    <DialogDescription>
                        {hasItems
                            ? "Select services, choose your event date, then pay to confirm."
                            : "Select your event date and make payment to confirm your booking."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Service Items Selector */}
                    {hasItems && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                Select Services
                            </Label>
                            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                                {serviceItems.map((item) => {
                                    const qty = getQty(item.id);
                                    return (
                                        <div key={item.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ₦{Number(item.unit_price).toLocaleString()} / {item.unit_label}
                                                    {item.description && ` · ${item.description}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setQuantity(item, qty - 1)}
                                                    disabled={qty === 0}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={10000}
                                                    value={qty === 0 ? "" : qty}
                                                    placeholder="0"
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        if (e.target.value === "") setQuantity(item, 0);
                                                        else if (!isNaN(val) && val >= 0 && val <= 10000) setQuantity(item, val);
                                                    }}
                                                    className="w-16 text-center text-sm font-semibold tabular-nums border border-input rounded-md h-7 px-1 focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setQuantity(item, qty + 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Date picker */}
                    <div className="space-y-2">
                        <Label>Event Date <span className="text-destructive">*</span></Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-white" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                    disabled={(d) => d <= new Date()}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Time picker */}
                    <div className="space-y-2">
                        <Label>
                            Event Time{" "}
                            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="time"
                                className="pl-9"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>
                            Notes{" "}
                            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <Textarea
                            placeholder="Tell the vendor about your event — theme, guest count, special requirements..."
                            className="resize-none min-h-[80px]"
                            maxLength={2000}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Event Address */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            Event Location
                            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                                placeholder="Venue / Event Hall name"
                                value={venueName}
                                onChange={(e) => setVenueName(e.target.value)}
                                className="sm:col-span-2"
                            />
                            <Input
                                placeholder="City"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                            <Input
                                placeholder="State"
                                value={eventState}
                                onChange={(e) => setEventState(e.target.value)}
                            />
                            <Input
                                placeholder="Delivery / Access instructions (optional)"
                                value={deliveryInstructions}
                                onChange={(e) => setDeliveryInstructions(e.target.value)}
                                className="sm:col-span-2"
                            />
                        </div>
                    </div>

                    {/* Price summary */}
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-2">
                        {/* Base rate — always shown */}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                Base rate
                                {hasItems && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded ml-1.5 font-medium">always included</span>}
                            </span>
                            <span className="font-medium">₦{startingPrice.toLocaleString()}</span>
                        </div>

                        {/* Selected service items */}
                        {hasItems && cart.size > 0 && Array.from(cart.values()).map((entry) => (
                            <div key={entry.item.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {entry.item.name} × {entry.quantity}
                                </span>
                                <span className="font-medium">
                                    ₦{(Number(entry.item.unit_price) * entry.quantity).toLocaleString()}
                                </span>
                            </div>
                        ))}

                        {/* Vendor service fee */}
                        {vendorServiceFee > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    Vendor service fee
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{Number(vendor.service_fee_percentage)}%</span>
                                </span>
                                <span>₦{vendorServiceFee.toLocaleString()}</span>
                            </div>
                        )}

                        {/* Logistics fee */}
                        {vendorLogisticsFee > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Logistics / delivery fee</span>
                                <span>₦{vendorLogisticsFee.toLocaleString()}</span>
                            </div>
                        )}

                        {/* Platform service fee */}
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                Platform service fee
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">2.5%</span>
                            </span>
                            <span>₦{serviceFee.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-center border-t border-primary/10 pt-2 mt-2">
                            <span className="font-semibold">Total due today</span>
                            <span className="text-xl font-bold text-primary">₦{grossTotal.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Secure payment via Paystack · fee included
                        </p>
                    </div>

                    {/* Action */}
                    {isValid ? (
                        isProcessing ? (
                            <Button disabled className="w-full h-11">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating booking...
                            </Button>
                        ) : (
                            // @ts-ignore
                            <PaystackButton
                                {...paystackProps}
                                amount={paystackAmount}
                                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/25"
                            >
                                <CreditCard className="h-4 w-4" /> Pay & Book — ₦{grossTotal.toLocaleString()}
                            </PaystackButton>
                        )
                    ) : (
                        <Button disabled className="w-full h-11">
                            {!user ? "Please log in to book" : !date ? "Select a date to continue" : "Select services to continue"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BookingModal;
