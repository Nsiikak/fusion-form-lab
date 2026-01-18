import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from "@/components/Footer";
import { Calendar, MapPin, Star, Clock, CheckCircle2, Package, LogOut, Loader2 } from "lucide-react";
import logo from "@/assets/plagohive-icon.svg";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";

// Recommended Vendors Component
const RecommendedVendors = () => {
  const { data: recommendedVendors = [], isLoading } = useQuery({
    queryKey: ["recommended-vendors"],
    queryFn: async () => {
      return await api.vendors.getRecommended(3);
    },
  });

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      catering: "🍽️",
      decoration: "🎨",
      photography: "📸",
      entertainment: "🎵",
      logistics: "🚚",
      venue: "🏛️",
    };
    return emojiMap[category] || "🏢";
  };

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
          <Link key={vendor.id} to={`/vendor-search`}>
            <Card className="overflow-hidden hover:shadow-elevated transition-all hover:-translate-y-1 cursor-pointer">
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-6xl">
                {getCategoryEmoji(vendor.category)}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">4.8</span>
                </div>
                <h3 className="font-bold mb-2">{vendor.business_name}</h3>
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

  // Get vendor name helper (will need to fetch vendor details)
  const getVendorName = (vendorId: number) => {
    // For now, return placeholder - will be enhanced when we add vendor details to booking response
    return `Vendor #${vendorId}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-12" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Find Vendors</Link>
              <Link to="/customer-dashboard" className="text-sm font-medium text-primary">Dashboard</Link>
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Welcome back, {user?.full_name || user?.email || "User"}!
            </h1>
            <p className="text-muted-foreground">Manage your events and bookings</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Upcoming Events</p>
                  <p className="text-3xl font-bold text-primary">
                    {statsLoading ? "..." : (stats?.upcoming_events || 0)}
                  </p>
                </div>
                <Calendar className="h-12 w-12 text-primary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Bookings</p>
                  <p className="text-3xl font-bold text-accent">
                    {statsLoading ? "..." : (stats?.active_bookings || 0)}
                  </p>
                </div>
                <Package className="h-12 w-12 text-accent/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Confirmed</p>
                  <p className="text-3xl font-bold text-secondary">
                    {statsLoading ? "..." : (stats?.confirmed_bookings || 0)}
                  </p>
                </div>
                <CheckCircle2 className="h-12 w-12 text-secondary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending</p>
                  <p className="text-3xl font-bold text-orange-500">
                    {statsLoading ? "..." : (stats?.pending_bookings || 0)}
                  </p>
                </div>
                <Clock className="h-12 w-12 text-orange-500/20" />
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="bookings" className="space-y-8">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="events">My Events</TabsTrigger>
              <TabsTrigger value="bookings">All Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Upcoming Events</h2>
                <Link to="/vendor-search">
                  <Button>Plan New Event</Button>
                </Link>
              </div>

              {eventsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">No events yet. Start planning your first event!</p>
                  <Link to="/vendor-search">
                    <Button>Plan New Event</Button>
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
                      <Card key={event.id} className="p-6 hover:shadow-elevated transition-all">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-bold">{event.name}</h3>
                              <Badge variant={event.status === "confirmed" ? "default" : "secondary"}>
                                {event.status}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {formatDate(event.date)}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {event.location}
                              </div>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                {confirmedEventBookings.length} vendor{confirmedEventBookings.length !== 1 ? 's' : ''} booked
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Cost</p>
                              <p className="text-2xl font-bold text-primary">
                                ₦{totalCost.toLocaleString()}
                              </p>
                            </div>
                            <Button variant="outline">View Details</Button>
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
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">No bookings yet. Start booking vendors for your events!</p>
                  <Link to="/vendor-search">
                    <Button>Find Vendors</Button>
                  </Link>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking: any) => (
                    <Card key={booking.id} className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold">{booking.vendor_name || `Vendor #${booking.vendor_id}`}</h3>
                            {booking.vendor_category && (
                              <Badge variant="secondary">{booking.vendor_category}</Badge>
                            )}
                            <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "pending" ? "secondary" : "outline"}>
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {formatDate(booking.event_date)}
                            </div>
                            {booking.event_id && (
                              <div>
                                Event ID: {booking.event_id}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Price</p>
                            <p className="text-xl font-bold">₦{Number(booking.price).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {booking.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await api.bookings.updateStatus(booking.id, "cancelled");
                                    window.location.reload();
                                  } catch (error) {
                                    console.error("Failed to cancel booking", error);
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                            <Button size="sm">View Details</Button>
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
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CustomerDashboard;
