import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import {
    MapPin,
    Star,
    DollarSign,
    CheckCircle2,
    ArrowLeft,
    Share2,
    MessageSquare,
    Loader2,
    Building2,
    User
} from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import BookingModal from "@/components/BookingModal";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const VendorDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const { data: vendor, isLoading } = useQuery({
        queryKey: ["vendor", id],
        queryFn: async () => {
            if (!id) return null;
            return await api.vendors.getById(parseInt(id));
        },
        enabled: !!id,
    });

    const { data: reviews = [] } = useQuery({
        queryKey: ["vendor-reviews", id],
        queryFn: async () => {
            if (!id) return [];
            return await api.reviews.getVendorReviews(parseInt(id));
        },
        enabled: !!id,
    });

    const handleBookClick = () => {
        if (!isAuthenticated) {
            navigate("/login?redirect=/vendors/" + id);
            return;
        }
        setIsBookingOpen(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!vendor) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
                <h2 className="text-2xl font-bold mb-4">Vendor not found</h2>
                <Button onClick={() => navigate("/vendor-search")}>Back to Search</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-border/40">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/">
                            <img src={logo} alt="Plagohive" className="h-12" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Link to="/vendor-search">
                                <Button variant="ghost" size="sm">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-16">
                {/* Cover Section */}
                <div className="relative h-[300px] md:h-[400px] bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />

                    <div className="container mx-auto px-4 h-full flex items-end pb-8 relative z-10">
                        <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-6">
                            <div className="flex items-end gap-6">
                                <div className="w-32 h-32 rounded-2xl bg-white shadow-2xl p-1 flex items-center justify-center -mb-16 md:mb-0">
                                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl flex items-center justify-center text-4xl">
                                        <Building2 className="h-12 w-12 text-primary/40" />
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <Badge variant="secondary" className="mb-2 capitalize">{vendor.category}</Badge>
                                    <h1 className="text-4xl font-bold text-foreground mb-2">{vendor.business_name}</h1>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-4 w-4" /> {vendor.location}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                            {vendor.average_rating ? vendor.average_rating.toFixed(1) : "New"} ({reviews.length} reviews)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline">
                                    <Share2 className="h-4 w-4 mr-2" /> Share
                                </Button>
                                <Button size="lg" className="shadow-lg hover:shadow-primary/30" onClick={handleBookClick}>
                                    Book Now
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 pt-12">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Details */}
                        <div className="lg:col-span-2 space-y-8">
                            <section className="animate-fade-in-up">
                                <h2 className="text-2xl font-bold mb-4">About</h2>
                                <Card className="p-6 bg-white border border-border shadow-sm">
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {vendor.description || "No description provided."}
                                    </p>
                                </Card>
                            </section>

                            <section className="animate-fade-in-up [animation-delay:200ms]">
                                <h2 className="text-2xl font-bold mb-4">Services & Pricing</h2>
                                <Card className="p-6 bg-white border border-border shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg">Standard Service Package</h3>
                                            <p className="text-sm text-muted-foreground">Starting price for base services</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-primary">₦{vendor.starting_price.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {["Professional Service", "Quality Assurance", "Timely Delivery"].map((feature) => (
                                            <div key={feature} className="flex items-center gap-2 text-sm">
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </section>

                            <section className="animate-fade-in-up [animation-delay:400ms]">
                                <h2 className="text-2xl font-bold mb-4">Reviews</h2>
                                <div className="space-y-4">
                                    {reviews.length === 0 ? (
                                        <Card className="p-8 text-center bg-white border border-dashed border-border">
                                            <p className="text-muted-foreground">No reviews yet.</p>
                                        </Card>
                                    ) : (
                                        reviews.map((review: any) => (
                                            <Card key={review.id} className="p-6 bg-white border border-border shadow-sm">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <User className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <span className="font-medium">Customer</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star
                                                                key={i}
                                                                className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-muted-foreground">{review.comment}</p>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Right Column - Sidebar */}
                        <div className="space-y-6">
                            <Card className="p-6 bg-white border border-border shadow-sm sticky top-24">
                                <h3 className="font-bold text-lg mb-4">Book this Vendor</h3>
                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Starting Price</span>
                                        <span className="font-semibold">₦{vendor.starting_price.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Response Time</span>
                                        <span className="font-semibold">~24 hours</span>
                                    </div>
                                </div>
                                <Button className="w-full shadow-lg" size="lg" onClick={handleBookClick}>
                                    Request Booking
                                </Button>
                                <div className="mt-4 text-center">
                                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Secure payment via Paystack
                                    </p>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            <BookingModal
                isOpen={isBookingOpen}
                onClose={() => setIsBookingOpen(false)}
                vendor={vendor}
            />


        </div>
    );
};

export default VendorDetails;
