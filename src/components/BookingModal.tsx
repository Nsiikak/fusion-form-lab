import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, CheckCircle2, Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PaystackButton } from "react-paystack";

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendor: {
        id: number;
        business_name: string;
        starting_price: number;
    };
}

const BookingModal = ({ isOpen, onClose, vendor }: BookingModalProps) => {
    const { user } = useAuth();
    const [date, setDate] = useState<Date>();
    const [time, setTime] = useState("");
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Paystack Config
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_YourPublicTestKeyHere"; // Fallback for dev
    const amount = vendor.starting_price * 100; // Paystack expects amount in kobo

    const handleSuccess = async (reference: any) => {
        setIsProcessing(true);
        try {
            // Create booking after payment success
            await api.bookings.create({
                vendor_id: vendor.id,
                price: vendor.starting_price,
                event_date: date ? format(date, "yyyy-MM-dd") : "",
                event_time: time,
                notes: notes,
                payment_reference: reference.reference,
            });

            toast.success("Booking confirmed! The vendor has been notified.");
            onClose();
        } catch (error) {

            toast.error("Payment successful but booking failed. Please contact support.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        toast.error("Payment cancelled.");
    };

    const paystackProps = {
        email: user?.email || "",
        amount,
        publicKey,
        text: "Pay Now",
        onSuccess: handleSuccess,
        onClose: handleClose,
        reference: `booking_${new Date().getTime()}`,
    };

    const isValid = date && time && user;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] glass-panel bg-white/95 backdrop-blur-xl border-primary/20">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-primary">Book {vendor.business_name}</DialogTitle>
                    <DialogDescription>
                        Complete your booking by selecting a date and making payment.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal glass-input hover:bg-white/50",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-white" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                    disabled={(date) => date < new Date()}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Time</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="time"
                                className="pl-9 glass-input"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                            placeholder="Tell the vendor about your event..."
                            className="resize-none glass-input"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Service Price</span>
                            <span className="font-bold">₦{vendor.starting_price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold text-primary border-t border-primary/10 pt-2 mt-2">
                            <span>Total</span>
                            <span>₦{vendor.starting_price.toLocaleString()}</span>
                        </div>
                    </div>

                    {isValid ? (
                        // @ts-ignore - paystack types might be missing
                        <PaystackButton
                            {...paystackProps}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="h-4 w-4" /> Pay & Book
                                </>
                            )}
                        </PaystackButton>
                    ) : (
                        <Button disabled className="w-full h-11">
                            {user ? "Fill details to continue" : "Please login to book"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BookingModal;
