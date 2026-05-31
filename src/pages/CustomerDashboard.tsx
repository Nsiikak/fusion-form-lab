import { useState } from "react";
import ReviewModal from "@/components/ReviewModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Star, Clock, CheckCircle2, Package, LogOut, Loader2, CreditCard, Utensils, Palette, Camera, Music, Truck, Building2, Store, Info } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";

// Recommended Vendors Component
const RecommendedVendors = () => {
  const { data: recommendedVendors = [], isLoading } = useQuery({
    queryKey: ["recommended-vendors"],
    queryFn: async () => {
      return await api.vendors.getRecommended(3);
    },
  });

  const categoryIconMap: Record<string, React.ElementType> = {
    catering: Utensils,
    decoration: Palette,
    photography: Camera,
    entertainment: Music,
    logistics: Truck,
    venue: Building2,
  };
  const getCategoryIcon = (category: string): React.ElementType => categoryIconMap[category] || Store;

  const getCategoryDisplayName = (category: string) => {
    const nameMap: Record<string, string> = {
      catering: "Catering",
      decoration: "Decoration",
      photography: "Photography",
      entertainment: "Entertainment",
      logistics: "Logistics",
      venue: "Venue",
    };
    return nameMap[category] || category;
  };

  if (isLoading) {
    return (
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Recommended for You</h2>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (recommendedVendors.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold mb-6">Recommended for You</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recommendedVendors.map((vendor: any) => (
          <Link key={vendor.id} to={`/vendors/${vendor.id}`}>
            <Card className="bg-white border border-border overflow-hidden hover:shadow-[var(--shadow-3d)] transition-all hover:-translate-y-1 cursor-pointer group">
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                {(() => { const Icon = getCategoryIcon(vendor.category); return <Icon className="h-10 w-10 text-primary/40" />; })()}
              </div>
              <div className="p-6">
                {vendor.average_rating != null && (
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{Number(vendor.average_rating).toFixed(1)}</span>
                  </div>
                )}
                <h3 className="font-bold mb-2 group-hover:text-primary transition-colors text-lg">{vendor.business_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {getCategoryDisplayName(vendor.category)}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<any>(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["customer-stats"],
    queryFn: async () => {
      return await api.stats.getCustomerStats();
    },
  });

  // Fetch events (used to resolve event names on bookings)
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => api.events.list(),
  });

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      return await api.bookings.list();
    },
  });

  const getEventName = (eventId: number) => {
    const event = events.find((e: any) => e.id === eventId);
    return event?.name || null;
  };

  const bookingRef = (id: number) =>
    `PLG-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src="/Plagohive.svg" alt="Plagohive" className="h-12 w-auto object-contain" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Find Vendors</Link>
              <Link to="/customer-dashboard" className="text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">Dashboard</Link>
              {user && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold">
                    {user.full_name?.[0] || user.email?.[0] || "U"}
                  </div>
                  {user.full_name || user.email}
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Welcome back, {user?.full_name?.split(' ')[0] || "User"}!
            </h1>
            <p className="text-muted-foreground text-lg">Manage your events and bookings from your personal command center.</p>
          </div>

          {/* Quick Stats */}
          {(() => {
            const needsConfirmation = (bookings as any[]).filter((b) => b.status === "awaiting_confirmation").length;
            return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in-up [animation-delay:200ms]">
            <Card className="bg-white border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Upcoming Events</p>
                  <p className="text-3xl font-bold text-primary">
                    {statsLoading ? "..." : (stats?.upcoming_events || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Awaiting Vendor</p>
                  <p className="text-3xl font-bold text-orange-500">
                    {statsLoading ? "..." : (stats?.pending_bookings || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Vendor hasn't responded yet</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Vendor Accepted</p>
                  <p className="text-3xl font-bold text-green-600">
                    {statsLoading ? "..." : (stats?.confirmed_bookings || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Booked & ready for your event</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className={`border p-6 hover:shadow-[var(--shadow-elevated)] transition-all ${needsConfirmation > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-1 ${needsConfirmation > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    Release Payment
                  </p>
                  <p className={`text-3xl font-bold ${needsConfirmation > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {bookingsLoading ? "..." : needsConfirmation}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {needsConfirmation > 0 ? "Go to All Bookings to confirm" : "Nothing pending from you"}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${needsConfirmation > 0 ? "bg-red-500/10" : "bg-muted/40"}`}>
                  <CreditCard className={`h-6 w-6 ${needsConfirmation > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                </div>
              </div>
            </Card>
          </div>
            );
          })()}

          {/* Bookings */}
          <div className="space-y-6 animate-fade-in-up [animation-delay:400ms]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Bookings</h2>
              <Link to="/vendor-search">
                <Button className="shadow-lg hover:shadow-primary/30">
                  <Calendar className="mr-2 h-4 w-4" />
                  Book a Vendor
                </Button>
              </Link>
            </div>

              {bookingsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : bookings.length === 0 ? (
                <Card className="bg-white border-2 border-dashed border-primary/20 p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <CreditCard className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Start booking vendors to see them here.</p>
                  <Link to="/vendor-search">
                    <Button size="lg" className="shadow-lg">Find Vendors</Button>
                  </Link>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking: any) => (
                    <Card key={booking.id} className="bg-white border border-border p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold">{booking.vendor_name}</h3>
                            <span className="text-xs font-mono text-muted-foreground">{bookingRef(booking.id)}</span>
                            {booking.vendor_category && (
                              <Badge variant="secondary" className="bg-secondary/10 text-secondary-foreground hover:bg-secondary/20">{booking.vendor_category}</Badge>
                            )}
                            <Badge
                              className={`${booking.status === "confirmed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" :
                                booking.status === "pending" ? "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20" :
                                booking.status === "awaiting_confirmation" ? "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20" :
                                booking.status === "completed" ? "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20" :
                                  "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                              {{
                                pending: "Pending",
                                confirmed: "Confirmed",
                                awaiting_confirmation: "Action Required",
                                completed: "Completed",
                                declined: "Declined",
                                cancelled: "Cancelled",
                              }[booking.status] ?? booking.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              {formatDate(booking.event_date)}
                            </div>
                            {booking.event_id && (
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                {getEventName(booking.event_id) || `Booking #${booking.id}`}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</p>
                            <p className="text-xl font-bold text-primary">₦{Number(booking.price).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center">
                            {booking.status === "confirmed" && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border rounded-full px-3 py-1.5">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                Waiting for vendor to mark service complete
                              </span>
                            )}
                            {booking.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/20 hover:bg-destructive/10"
                                onClick={async () => {
                                  try {
                                    await api.bookings.updateStatus(booking.id, "cancelled");
                                    toast.success("Booking cancelled.");
                                    queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                  } catch (error) {
                                    toast.error("Failed to cancel booking");
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                            {booking.status === "awaiting_confirmation" && (() => {
                              const confirmedAt = booking.vendor_confirmed_at
                                ? new Date(booking.vendor_confirmed_at)
                                : null;
                              const autoReleaseAt = confirmedAt
                                ? new Date(confirmedAt.getTime() + 24 * 60 * 60 * 1000)
                                : null;
                              const hoursLeft = autoReleaseAt
                                ? Math.max(0, Math.ceil((autoReleaseAt.getTime() - Date.now()) / 3_600_000))
                                : null;
                              return (
                                <div className="flex flex-col items-start gap-1">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white shadow-md font-semibold"
                                    onClick={async () => {
                                      try {
                                        await api.bookings.updateStatus(booking.id, "completed");
                                        toast.success("Payment released to vendor. Thank you!");
                                        queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                        queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
                                      } catch (error: any) {
                                        toast.error(error.response?.data?.detail || "Failed to confirm");
                                      }
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                    Confirm Service &amp; Release Payment
                                  </Button>
                                  <p className="text-[11px] text-muted-foreground pl-0.5">
                                    Vendor marked this service complete.{hoursLeft !== null ? ` Auto-releases in ~${hoursLeft}h if no action.` : ""}
                                  </p>
                                </div>
                              );
                            })()}

                            {booking.status === "completed" && !booking.has_review && (
                              <Button
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsReviewModalOpen(true);
                                }}
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Rate Vendor
                              </Button>
                            )}

                            {booking.status === "completed" && booking.has_review && (
                              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Reviewed
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/20 hover:bg-primary/5"
                              onClick={() => { setDetailBooking(booking); setBookingDetailOpen(true); }}
                            >
                              <Info className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
          </div>

          {/* Recommended Vendors */}
          <RecommendedVendors />

          {selectedBooking && (
            <ReviewModal
              isOpen={isReviewModalOpen}
              onClose={() => setIsReviewModalOpen(false)}
              booking={{
                id: selectedBooking.id,
                vendor_id: selectedBooking.vendor_id,
                vendor_name: selectedBooking.vendor_name
              }}
              onReviewSubmitted={() => {
                queryClient.invalidateQueries({ queryKey: ["bookings"] });
                queryClient.invalidateQueries({ queryKey: ["vendor-reviews", String(selectedBooking.vendor_id)] });
              }}
            />
          )}

          {/* Booking Detail Modal */}
          <Dialog open={bookingDetailOpen} onOpenChange={setBookingDetailOpen}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Booking Details</DialogTitle>
              </DialogHeader>
              {detailBooking && (
                <div className="space-y-4 pt-2">
                  {/* Reference & status row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Reference</p>
                      <p className="text-sm font-bold font-mono tracking-wider">{bookingRef(detailBooking.id)}</p>
                    </div>
                    <Badge className={
                      detailBooking.status === "confirmed" ? "bg-green-500/10 text-green-700" :
                      detailBooking.status === "completed" ? "bg-blue-500/10 text-blue-700" :
                      detailBooking.status === "pending" ? "bg-orange-500/10 text-orange-700" :
                      "bg-gray-100 text-gray-700"
                    }>
                      {detailBooking.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-muted-foreground">Vendor</div>
                    <div className="font-medium">{detailBooking.vendor_name}</div>

                    {detailBooking.vendor_category && (
                      <>
                        <div className="text-muted-foreground">Category</div>
                        <div className="font-medium capitalize">{detailBooking.vendor_category}</div>
                      </>
                    )}

                    {detailBooking.event_id && (
                      <>
                        <div className="text-muted-foreground">Event</div>
                        <div className="font-medium">{getEventName(detailBooking.event_id) || "—"}</div>
                      </>
                    )}

                    <div className="text-muted-foreground">Event Date</div>
                    <div className="font-medium">{formatDate(detailBooking.event_date)}</div>

                    <div className="text-muted-foreground">Payment</div>
                    <div className="flex items-center gap-1 font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                    </div>

                    <div className="text-muted-foreground">Total Paid</div>
                    <div className="font-bold text-primary">₦{Number(detailBooking.price).toLocaleString()}</div>
                  </div>

                  {/* Service items breakdown */}
                  {detailBooking.service_items_snapshot && detailBooking.service_items_snapshot.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services Ordered</p>
                      </div>
                      <div className="divide-y divide-border">
                        {detailBooking.service_items_snapshot.map((s: any, i: number) => (
                          <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                            <span className="text-foreground">
                              {s.name} <span className="text-muted-foreground">× {s.quantity}</span>
                            </span>
                            <span className="font-medium">₦{Number(s.subtotal).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailBooking.notes && (
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-foreground bg-muted/30 rounded-lg px-3 py-2">{detailBooking.notes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t flex gap-2">
                    <Link to={`/vendors/${detailBooking.vendor_id}`} className="flex-1">
                      <Button variant="outline" className="w-full" onClick={() => setBookingDetailOpen(false)}>
                        View Vendor
                      </Button>
                    </Link>
                    <Button className="flex-1" onClick={() => setBookingDetailOpen(false)}>Close</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
};

export default CustomerDashboard;
