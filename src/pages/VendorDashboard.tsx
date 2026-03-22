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
  Loader2,
  Settings,
  Package
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-10" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-dashboard" className="text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">Dashboard</Link>
              <Link to="/profile" className="text-sm font-medium hover:text-primary transition-colors">Profile</Link>
              {user && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-accent text-white flex items-center justify-center font-bold shadow-sm">
                    {user.business_name?.[0] || user.full_name?.[0] || "V"}
                  </div>
                  <span className="hidden sm:inline">{user.business_name || user.full_name}</span>
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Welcome Section */}
          <div className="mb-12 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  Vendor Dashboard
                </h1>
                <p className="text-muted-foreground text-lg">
                  Welcome back, <span className="font-semibold text-foreground">{user?.business_name || "Partner"}</span>
                </p>
              </div>
              <Button className="shadow-lg hover:shadow-primary/30 bg-primary hover:bg-primary/90 text-white">
                <Settings className="mr-2 h-4 w-4" />
                Manage Profile
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in-up [animation-delay:200ms]">
            <Card className="glass-panel p-6 hover:shadow-[var(--shadow-elevated)] transition-all bg-white/80 hover:bg-white/90 border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Earnings</p>
                  {statsLoading ? (
                    <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-primary">
                      ₦{(stats?.total_earnings || 0).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-sm">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="glass-panel p-6 hover:shadow-[var(--shadow-elevated)] transition-all bg-white/80 hover:bg-white/90 border-accent/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bookings</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-accent">
                      {stats?.active_bookings || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center shadow-sm">
                  <Package className="h-6 w-6 text-accent" />
                </div>
              </div>
            </Card>

            <Card className="glass-panel p-6 hover:shadow-[var(--shadow-elevated)] transition-all bg-white/80 hover:bg-white/90 border-secondary/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Rating</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-secondary">
                      {stats?.average_rating > 0 ? stats.average_rating.toFixed(1) : "N/A"}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center shadow-sm">
                  <Star className="h-6 w-6 text-secondary fill-secondary" />
                </div>
              </div>
            </Card>

            <Card className="glass-panel p-6 hover:shadow-[var(--shadow-elevated)] transition-all bg-white/80 hover:bg-white/90 border-blue-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Views</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-500">
                      {stats?.total_clients || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="bookings" className="space-y-8 animate-fade-in-up [animation-delay:400ms]">
            <TabsList className="bg-white/80 backdrop-blur-sm p-1 rounded-xl border border-white/20 w-fit shadow-sm">
              <TabsTrigger value="bookings" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-medium">Bookings</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-medium">Reviews</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-medium">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Recent Bookings</h2>
              </div>

              {bookingsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground animate-pulse">Loading bookings...</p>
                </div>
              ) : bookings.length === 0 ? (
                <Card className="glass-panel p-12 text-center border-dashed border-2 border-primary/20 bg-primary/5">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Package className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">When customers book your services, they will appear here.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking: any) => (
                    <Card key={booking.id} className="glass-panel p-6 hover:shadow-lg transition-shadow bg-white/80 hover:bg-white/95">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold text-foreground">Event ID: #{booking.event_id}</h3>
                            <Badge
                              className={`${booking.status === "confirmed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" :
                                booking.status === "pending" ? "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20" :
                                  "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                }`}
                            >
                              {booking.status === "confirmed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                              {booking.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              {formatDate(booking.event_date)}
                              {booking.event_time && ` at ${formatTime(booking.event_time)}`}
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              Customer ID: {booking.customer_id}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
                            <p className="text-xl font-bold text-primary">₦{Number(booking.price).toLocaleString()}</p>
                          </div>

                          <div className="flex gap-2">
                            {booking.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDecline(booking.id)}
                                  disabled={updateBookingStatus.isPending}
                                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                                >
                                  Decline
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(booking.id)}
                                  disabled={updateBookingStatus.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                              </>
                            )}
                            {booking.status === "confirmed" && (
                              <Button
                                size="sm"
                                onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, status: "completed" })}
                                disabled={updateBookingStatus.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Mark Completed
                              </Button>
                            )}
                            {booking.status !== "pending" && booking.status !== "confirmed" && (
                              <Button size="sm" variant="outline" className="border-primary/20 hover:bg-primary/5">View Details</Button>
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
                <h2 className="text-2xl font-bold text-foreground">Customer Reviews</h2>
                <div className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold">{averageRating > 0 ? averageRating.toFixed(1) : "N/A"}</span>
                  <span className="text-muted-foreground">({totalReviews} review{totalReviews !== 1 ? 's' : ''})</span>
                </div>
              </div>

              {reviewsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground animate-pulse">Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <Card className="glass-panel p-12 text-center border-dashed border-2 border-primary/20 bg-primary/5">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Star className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No reviews yet</h3>
                  <p className="text-muted-foreground">Reviews will appear here once customers rate your services.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <Card key={review.id} className="glass-panel p-6 bg-white/80 hover:bg-white/95 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold mb-1 text-foreground">Customer #{review.customer_id}</h3>
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

            <TabsContent value="settings" className="space-y-6">
              <Card className="glass-panel p-6 bg-white/80">
                <h2 className="text-2xl font-bold mb-6 text-foreground">Payout Settings</h2>
                <p className="text-muted-foreground mb-6">Enter your bank details to receive payouts automatically when you complete bookings.</p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const account_number = formData.get("account_number") as string;
                    const bank_code = formData.get("bank_code") as string;

                    if (!account_number || !bank_code) {
                      toast.error("Please fill in all bank details");
                      return;
                    }

                    try {
                      await api.vendors.updateMyVendor({
                        account_number,
                        bank_code
                      });
                      toast.success("Bank details saved successfully!");
                      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
                    } catch (error: any) {
                      toast.error(error.response?.data?.detail || "Failed to save bank details");
                    }
                  }}
                  className="space-y-4 max-w-md"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bank Name</label>
                    <select
                      name="bank_code"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      defaultValue={vendorProfile?.bank_code || ""}
                    >
                      <option value="">Select Bank</option>
                      <option value="044">Access Bank</option>
                      <option value="058">Guaranty Trust Bank</option>
                      <option value="033">United Bank for Africa</option>
                      <option value="057">Zenith Bank</option>
                      <option value="011">First Bank of Nigeria</option>
                      {/* Short list for demo, ideally fetched from Paystack API */}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account Number</label>
                    <input
                      type="text"
                      name="account_number"
                      placeholder="0123456789"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      defaultValue={vendorProfile?.account_number || ""}
                      maxLength={10}
                    />
                  </div>

                  <Button type="submit" className="w-full">Save Bank Details</Button>
                </form>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Performance Chart Placeholder */}
          <section className="mt-16 sm:pb-8">
            <Card className="glass-panel p-6 bg-white/80">
              <h2 className="text-2xl font-bold mb-6 text-foreground">Performance Overview</h2>
              <div className="h-64 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg flex items-center justify-center border border-primary/10 border-dashed">
                <div className="text-center">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-primary/30" />
                  <p className="text-muted-foreground font-medium">Performance analytics coming soon</p>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </section>


    </div>
  );
};

export default VendorDashboard;
