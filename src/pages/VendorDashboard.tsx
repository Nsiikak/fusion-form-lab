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
  XCircle
} from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";

const bookings = [
  { 
    id: 1, 
    customer: "John Doe", 
    event: "Wedding Ceremony",
    status: "confirmed", 
    price: 150000,
    date: "Dec 15, 2025",
    time: "2:00 PM"
  },
  { 
    id: 2, 
    customer: "Jane Smith", 
    event: "Birthday Party",
    status: "pending", 
    price: 80000,
    date: "Dec 20, 2025",
    time: "6:00 PM"
  },
  { 
    id: 3, 
    customer: "Mike Johnson", 
    event: "Corporate Event",
    status: "completed", 
    price: 200000,
    date: "Nov 30, 2025",
    time: "10:00 AM"
  },
];

const reviews = [
  {
    id: 1,
    customer: "Sarah Williams",
    rating: 5,
    comment: "Excellent service! The food was amazing and the presentation was perfect.",
    date: "2 days ago"
  },
  {
    id: 2,
    customer: "David Brown",
    rating: 4,
    comment: "Great experience overall. Very professional and timely.",
    date: "1 week ago"
  },
];

const VendorDashboard = () => {
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
              <Link to="/vendor-dashboard" className="text-sm font-medium text-primary">Dashboard</Link>
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Browse Platform</Link>
              <Button>Profile Settings</Button>
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
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">Premium Catering Co.</h1>
                <p className="text-muted-foreground">Manage your bookings and grow your business</p>
              </div>
              <Badge className="w-fit bg-accent text-lg px-4 py-2">
                ✓ Verified Vendor
              </Badge>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold text-primary">₦2.4M</p>
                </div>
                <DollarSign className="h-10 w-10 text-primary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Bookings</p>
                  <p className="text-2xl font-bold text-accent">12</p>
                </div>
                <Calendar className="h-10 w-10 text-accent/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Rating</p>
                  <p className="text-2xl font-bold text-secondary">4.8★</p>
                </div>
                <Star className="h-10 w-10 text-secondary/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Clients</p>
                  <p className="text-2xl font-bold text-orange-500">124</p>
                </div>
                <Users className="h-10 w-10 text-orange-500/20" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Growth</p>
                  <p className="text-2xl font-bold text-green-500">+24%</p>
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

              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold">{booking.customer}</h3>
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
                            {booking.date} at {booking.time}
                          </div>
                          <div>
                            Event: {booking.event}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Payment</p>
                          <p className="text-xl font-bold text-primary">₦{booking.price.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          {booking.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline">
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                              <Button size="sm">
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
            </TabsContent>

            <TabsContent value="reviews" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Customer Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold">4.8</span>
                  <span className="text-muted-foreground">(124 reviews)</span>
                </div>
              </div>

              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id} className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold mb-1">{review.customer}</h3>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{review.date}</span>
                    </div>
                    <p className="text-muted-foreground">{review.comment}</p>
                  </Card>
                ))}
              </div>
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
