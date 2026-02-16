import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: {
        id: number;
        vendor_id: number;
        vendor_name?: string;
    };
    onReviewSubmitted: () => void;
}

const ReviewModal = ({ isOpen, onClose, booking, onReviewSubmitted }: ReviewModalProps) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Please select a rating");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.reviews.create({
                vendor_id: booking.vendor_id,
                booking_id: booking.id,
                rating,
                comment,
            });
            toast.success("Review submitted successfully!");
            onReviewSubmitted();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] glass-panel bg-white/95 backdrop-blur-xl border-primary/20">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-primary">Rate your experience</DialogTitle>
                    <DialogDescription>
                        How was your service with {booking.vendor_name || "this vendor"}?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center gap-2">
                        <Label>Tap to Rate</Label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className="focus:outline-none transition-transform hover:scale-110"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                >
                                    <Star
                                        className={`h-8 w-8 ${star <= (hoverRating || rating)
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-300"
                                            } transition-colors`}
                                    />
                                </button>
                            ))}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground h-4">
                            {hoverRating > 0 ? ["Poor", "Fair", "Good", "Very Good", "Excellent"][hoverRating - 1] : ""}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Write a Review (Optional)</Label>
                        <Textarea
                            placeholder="Share details about your experience..."
                            className="resize-none glass-input min-h-[100px]"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-lg"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                            </>
                        ) : (
                            "Submit Review"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ReviewModal;
