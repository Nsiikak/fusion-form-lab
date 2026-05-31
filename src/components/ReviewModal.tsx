import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, X } from "lucide-react";
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

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

const ReviewModal = ({ isOpen, onClose, booking, onReviewSubmitted }: ReviewModalProps) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);

    // Reset state whenever modal is closed
    useEffect(() => {
        if (!isOpen) {
            setRating(0);
            setComment("");
            setHoverRating(0);
        }
    }, [isOpen]);

    const displayRating = hoverRating || rating;

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Please select a star rating before submitting");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.reviews.create({
                vendor_id: booking.vendor_id,
                booking_id: booking.id,
                rating,
                comment: comment.trim() || undefined,
            });
            toast.success("Review submitted — thank you!");
            onReviewSubmitted();
            onClose();
        } catch (error: any) {
            const msg = error.response?.data?.detail;
            if (typeof msg === "string") {
                toast.error(msg);
            } else {
                toast.error("Failed to submit review. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-white border border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Rate your experience</DialogTitle>
                    <DialogDescription>
                        How was your service with <span className="font-semibold text-foreground">{booking.vendor_name || "this vendor"}</span>?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Star rating */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                                >
                                    <Star
                                        className={`h-9 w-9 transition-colors ${
                                            star <= displayRating
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-200"
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {/* Label persists after selection, not just on hover */}
                        <p className={`text-sm font-semibold h-5 transition-opacity ${displayRating > 0 ? "opacity-100" : "opacity-0"}`}>
                            {RATING_LABELS[displayRating]}
                        </p>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label htmlFor="review-comment">
                            Your review <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="review-comment"
                            placeholder="Tell others what made this vendor stand out — or what they could improve..."
                            className="resize-none min-h-[100px]"
                            maxLength={2000}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        {comment.length > 1800 && (
                            <p className="text-xs text-muted-foreground text-right">{2000 - comment.length} characters left</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Maybe later
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || rating === 0}
                            className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-sm"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                            ) : (
                                "Submit Review"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ReviewModal;
