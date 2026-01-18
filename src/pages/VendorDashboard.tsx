import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from "@/components/Footer";
import {
  Calendar,
  DollarSign,
  Star,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  LogOut,
  Loader2
} from "lucide-react";
import logo from "@/assets/plagohive-icon.svg";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

const VendorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Fetch vendor profile
  const { data: vendorProfile } = useQuery({
    queryKey: ["vendor-profile"],
    queryFn: async () => {
      return await api.vendors.getMyVendor();
    },
    enabled: !!user && user.role === "vendor",
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["vendor-stats"],
    queryFn: async () => {
      return await api.stats.getVendorStats();
    },
    enabled: !!user && user.role === "vendor",
  });

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["vendor-bookings"],
    queryFn: async () => {
      return await api.bookings.list();
    },
    enabled: !!user && user.role === "vendor",
  });

  // Update booking status mutation
  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: string }) => {
      return await api.bookings.updateStatus(bookingId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });
      toast.success("Booking status updated");
    },
    onError: () => {
      toast.error("Failed to update booking status");
    },
  });

  // Fetch reviews and rating
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["vendor-reviews"],
    queryFn: async () => {
      if (!vendorProfile) return [];
      return await api.reviews.getVendorReviews(vendorProfile.id);
    },
    enabled: !!vendorProfile,
  });

  const { data: ratingData } = useQuery({
    queryKey: ["vendor-rating", vendorProfile?.id],
    queryFn: async () => {
      if (!vendorProfile) return { average_rating: 0, total_reviews: 0 };
      return await api.reviews.getVendorRating(vendorProfile.id);
    },
    enabled: !!vendorProfile,
  });

  const averageRating = ratingData?.average_rating || 0;
  const totalReviews = ratingData?.total_reviews || 0;

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "";
    try {
      return format(new Date(`2000-01-01T${timeString}`), "h:mm a");
    } catch {
      return timeString;
    }
  };

  const handleAccept = (bookingId: number) => {
    updateBookingStatus.mutate({ bookingId, status: "confirmed" });
  };

  const handleDecline = (bookingId: number) => {
    updateBookingStatus.mutate({ bookingId, status: "declined" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-14" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-dashboard" className="text-sm font-medium text-primary">Dashboard</Link>
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Browse Platform</Link>
              {user && (
                <span className="text-sm text-muted-foreground">
                  {user.full_name || user.email}
                </span>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Welcome Section */}
          <div className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  {vendorProfile?.business_name || "Your Business"}
                </h1>
                <p className="text-muted-foreground">Manage your bookings and grow your business</p>
              </div>
              {vendorProfile?.verification_status === "approved" && (
                <Badge className="w-fit bg-accent text-lg px-4 py-2">
                  ✓ Verified Vendor
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold text-primary">
                    {statsLoading ? "..." : `₦${(stats?.total_earnings || 0) / 1000000 >= 1 ? ((stats?.total_earnings || 0) / 1000000).toFixed(1) + "M" : ((stats?.total_earnings || 0) / 1000).toFixed(0) + "K"}`}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-primary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Bookings</p>
                  <p className="text-2xl font-bold text-accent">
                    {statsLoading ? "..." : (stats?.active_bookings || 0)}
                  </p>
                </div>
                <Calendar className="h-10 w-10 text-accent/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Rating</p>
                  <p className="text-2xl font-bold text-secondary">
                    {statsLoading ? "..." : (stats?.average_rating > 0 ? `${stats.average_rating.toFixed(1)}★` : "N/A")}
                  </p>
                </div>
                <Star className="h-10 w-10 text-secondary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Clients</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {statsLoading ? "..." : (stats?.total_clients || 0)}
                  </p>
                </div>
                <Users className="h-10 w-10 text-orange-500/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Growth</p>
                  <p className="text-2xl font-bold text-green-500">
                    {statsLoading ? "..." : `+${stats?.growth_percentage || 0}%`}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-500/20" />
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="bookings" className="space-y-8">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Bookings</h2>
                <Button>Update Availability</Button>
              </div>

              {bookingsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : bookings.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No bookings yet. Your bookings will appear here once customers book your services.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking: any) => (
                    <Card key={booking.id} className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold">{booking.customer_name || booking.customer_email || `Customer #${booking.customer_id}`}</h3>
                            <Badge
                              variant={
                                booking.status === "confirmed" ? "default" :
                                  booking.status === "pending" ? "secondary" :
                                    "outline"
                              }
                            >
                              {booking.status === "confirmed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                              {booking.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {formatDate(booking.event_date)}
                              {booking.event_time && ` at ${formatTime(booking.event_time)}`}
                            </div>
                            {booking.event_id && (
                              <div>
                                Event ID: {booking.event_id}
                              </div>
                            )}
                            {booking.notes && (
                              <div className="text-xs">
                                Notes: {booking.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Payment</p>
                            <p className="text-xl font-bold text-primary">
                              ₦{Number(booking.price).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {booking.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDecline(booking.id)}
                                  disabled={updateBookingStatus.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Decline
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(booking.id)}
                                  disabled={updateBookingStatus.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                              </>
                            )}
                            {booking.status !== "pending" && (
                              <Button size="sm" variant="outline">View Details</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Customer Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold">{averageRating > 0 ? averageRating.toFixed(1) : "N/A"}</span>
                  <span className="text-muted-foreground">({totalReviews} review{totalReviews !== 1 ? 's' : ''})</span>
                </div>
              </div>

              {reviewsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : reviews.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No reviews yet. Reviews will appear here once customers rate your services.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <Card key={review.id} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold mb-1">Customer #{review.customer_id}</h3>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                                  }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-muted-foreground">{review.comment}</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Performance Chart Placeholder */}
          <section className="mt-16">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Performance Overview</h2>
              <div className="h-64 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Performance chart coming soon</p>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VendorDashboard;
