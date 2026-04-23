import { useState } from "react";
import ReviewModal from "@/components/ReviewModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Star, Clock, CheckCircle2, Package, LogOut, Loader2, CreditCard, ChevronRight, Utensils, Palette, Camera, Music, Truck, Building2, Store } from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
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

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      return await api.events.list();
    },
  });

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      return await api.bookings.list();
    },
  });

  // Filter upcoming events (date >= today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter((e: any) => {
    const eventDate = new Date(e.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && e.status !== "cancelled";
  });

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
              <img src={logo} alt="Plagohive" className="h-12" />
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
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active Bookings</p>
                  <p className="text-3xl font-bold text-accent">
                    {statsLoading ? "..." : (stats?.active_bookings || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
                  <Package className="h-6 w-6 text-accent" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Confirmed</p>
                  <p className="text-3xl font-bold text-secondary">
                    {statsLoading ? "..." : (stats?.confirmed_bookings || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pending</p>
                  <p className="text-3xl font-bold text-orange-500">
                    {statsLoading ? "..." : (stats?.pending_bookings || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="events" className="space-y-8 animate-fade-in-up [animation-delay:400ms]">
            <TabsList className="bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-white/20 w-fit">
              <TabsTrigger value="events" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">My Events</TabsTrigger>
              <TabsTrigger value="bookings" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">All Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Upcoming Events</h2>
                <Link to="/vendor-search">
                  <Button className="shadow-lg hover:shadow-primary/30">
                    <Calendar className="mr-2 h-4 w-4" />
                    Plan New Event
                  </Button>
                </Link>
              </div>

              {eventsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <Card className="bg-white border-2 border-dashed border-primary/20 p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Calendar className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No events yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Ready to plan something amazing? Start by finding vendors for your first event.</p>
                  <Link to="/vendor-search">
                    <Button size="lg" className="shadow-lg">Plan New Event</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {upcomingEvents.map((event: any) => {
                    // Count bookings for this event
                    const eventBookings = bookings.filter((b: any) => b.event_id === event.id);
                    const confirmedEventBookings = eventBookings.filter((b: any) => b.status === "confirmed");
                    const totalCost = confirmedEventBookings.reduce((sum: number, b: any) => sum + Number(b.price), 0);

                    return (
                      <Card key={event.id} className="bg-white border border-border p-6 hover:shadow-[var(--shadow-3d)] transition-all">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-bold">{event.name}</h3>
                              <Badge variant={event.status === "confirmed" ? "default" : "secondary"} className="rounded-md px-2.5 py-0.5">
                                {event.status}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                {formatDate(event.date)}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                {event.location}
                              </div>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                {confirmedEventBookings.length} vendor{confirmedEventBookings.length !== 1 ? 's' : ''} booked
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-t pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6 border-border/10">
                            <div className="text-right">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cost</p>
                              <p className="text-2xl font-bold text-primary">
                                ₦{totalCost.toLocaleString()}
                              </p>
                            </div>
                            <Button variant="outline" className="border-primary/20 hover:bg-primary/5">
                              View Details
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="bookings" className="space-y-6">
              <h2 className="text-2xl font-bold">All Bookings</h2>

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
                            <h3 className="text-lg font-bold">{booking.vendor_name || `Vendor #${booking.vendor_id}`}</h3>
                            {booking.vendor_category && (
                              <Badge variant="secondary" className="bg-secondary/10 text-secondary-foreground hover:bg-secondary/20">{booking.vendor_category}</Badge>
                            )}
                            <Badge
                              className={`${booking.status === "confirmed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" :
                                booking.status === "pending" ? "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20" :
                                  "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                              {booking.status}
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
                                Event ID: {booking.event_id}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</p>
                            <p className="text-xl font-bold text-primary">₦{Number(booking.price).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
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
                            {booking.status === "confirmed" && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                                onClick={async () => {
                                  try {
                                    await api.bookings.updateStatus(booking.id, "completed");
                                    toast.success("Booking marked as completed!");
                                    queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                    // Open review modal immediately after completion
                                    setSelectedBooking(booking);
                                    setIsReviewModalOpen(true);
                                  } catch (error) {
                                    toast.error("Failed to update status");
                                  }
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Confirm Completion
                              </Button>
                            )}

                            {booking.status === "completed" && (
                              <Button
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsReviewModalOpen(true);
                                }}
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Rate Provider
                              </Button>
                            )}
                            <Button size="sm" className="shadow-md" onClick={() => navigate(`/vendors/${booking.vendor_id}`)}>View Details</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

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
                // Also invalidate reviews if we had them here, but mostly bookings history update (maybe add 'Reviewed' badge later?)
                // For now just close.
              }}
            />
          )}
        </div>
      </section >


    </div >
  );
};

export default CustomerDashboard;
