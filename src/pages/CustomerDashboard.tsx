import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from "@/components/Footer";
import { Calendar, MapPin, Star, Clock, CheckCircle2, Package, LogOut } from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const upcomingEvents = [
  {
    id: 1,
    name: "Sarah's Wedding",
    date: "Dec 15, 2025",
    location: "Lagos",
    vendors: 5,
    status: "confirmed",
    totalCost: 850000,
  },
  {
    id: 2,
    name: "Corporate Retreat",
    date: "Jan 20, 2026",
    location: "Abuja",
    vendors: 3,
    status: "pending",
    totalCost: 450000,
  },
];

const bookings = [
  { 
    id: 1, 
    vendor: "Premium Catering Co.", 
    category: "Catering",
    event: "Sarah's Wedding",
    status: "confirmed", 
    price: 150000,
    date: "Dec 15, 2025"
  },
  { 
    id: 2, 
    vendor: "Elegant Decor", 
    category: "Decoration",
    event: "Sarah's Wedding",
    status: "confirmed", 
    price: 80000,
    date: "Dec 15, 2025"
  },
  { 
    id: 3, 
    vendor: "Snapshot Studios", 
    category: "Photography",
    event: "Sarah's Wedding",
    status: "pending", 
    price: 120000,
    date: "Dec 15, 2025"
  },
];

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-10" />
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
                  <p className="text-3xl font-bold text-primary">2</p>
                </div>
                <Calendar className="h-12 w-12 text-primary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Bookings</p>
                  <p className="text-3xl font-bold text-accent">8</p>
                </div>
                <Package className="h-12 w-12 text-accent/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Confirmed</p>
                  <p className="text-3xl font-bold text-secondary">5</p>
                </div>
                <CheckCircle2 className="h-12 w-12 text-secondary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending</p>
                  <p className="text-3xl font-bold text-orange-500">3</p>
                </div>
                <Clock className="h-12 w-12 text-orange-500/20" />
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="events" className="space-y-8">
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

              <div className="grid gap-6">
                {upcomingEvents.map((event) => (
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
                            {event.date}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {event.location}
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {event.vendors} vendors booked
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total Cost</p>
                          <p className="text-2xl font-bold text-primary">₦{event.totalCost.toLocaleString()}</p>
                        </div>
                        <Button variant="outline">View Details</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bookings" className="space-y-6">
              <h2 className="text-2xl font-bold">All Bookings</h2>

              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold">{booking.vendor}</h3>
                          <Badge variant="secondary">{booking.category}</Badge>
                          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                            {booking.status}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {booking.date}
                          </div>
                          <div>
                            Event: {booking.event}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="text-xl font-bold">₦{booking.price.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Message</Button>
                          <Button size="sm">View Booking</Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Recommended Vendors */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Recommended for You</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden hover:shadow-elevated transition-all hover:-translate-y-1 cursor-pointer">
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-6xl">
                    {i === 1 ? "🎵" : i === 2 ? "🚚" : "🏛️"}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">4.8</span>
                    </div>
                    <h3 className="font-bold mb-2">
                      {i === 1 ? "Party Vibes DJ" : i === 2 ? "Swift Logistics" : "Grand Halls"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {i === 1 ? "Entertainment" : i === 2 ? "Logistics" : "Venue"}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CustomerDashboard;
