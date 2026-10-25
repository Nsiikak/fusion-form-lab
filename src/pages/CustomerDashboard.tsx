import { useEffect, useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Star, Clock, CheckCircle2, Package, LogOut, Loader2, CreditCard, Utensils, Palette, Camera, Music, Truck, Building2, Store, Info, Plus, MapPin, Banknote, ChevronDown, ChevronUp, AlertTriangle, Scale } from "lucide-react";
import ReportProblemDialog from "@/components/ReportProblemDialog";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardHeader from "@/components/common/DashboardHeader";
import BookingTimeline from "@/components/common/BookingTimeline";
import RefundAccountCard from "@/components/common/RefundAccountCard";
import { ShowMoreButton, useShowMore } from "@/components/common/ShowMore";
import AddonsPanel from "@/components/common/AddonsPanel";
import EventChecklist from "@/components/common/EventChecklist";
import { OCCASIONS, occasionBySlug } from "@/lib/occasions";
import { CATEGORIES } from "@/lib/categories";
import ImageCarousel from "@/components/common/ImageCarousel";
import QuoteCard from "@/components/common/QuoteCard";
import { useFavorites } from "@/components/common/FavoriteButton";
import { thumb } from "@/lib/images";
import { CancelBookingDialog } from "@/components/common/CancellationDialogs";
import { FileText, MessageCircle } from "lucide-react";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";

// Recommended Vendors Component
const RecommendedVendors = () => {
  const { data: recommendedVendors = [], isLoading } = useQuery({
    queryKey: ["recommended-vendors"],
    queryFn: async () => {
      return await api.vendors.getRecommended(6);
    },
  });
  const rec = useShowMore(recommendedVendors as any[], 3);

  const categoryIconMap: Record<string, React.ElementType> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.icon]));
  const getCategoryIcon = (category: string): React.ElementType => categoryIconMap[category] || Store;

  const getCategoryDisplayName = (category: string) => {
    const nameMap: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
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
        {rec.visible.map((vendor: any) => (
          <Link key={vendor.id} to={`/vendors/${vendor.id}`}>
            <Card className="bg-white border border-border overflow-hidden hover:shadow-[var(--shadow-3d)] transition-all hover:-translate-y-1 cursor-pointer group">
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                {vendor.gallery_images?.length ? (
                  <ImageCarousel images={vendor.gallery_images.slice(0, 6)} alt={vendor.business_name} className="w-full h-full" />
                ) : vendor.profile_image_url ? (
                  <img src={vendor.profile_image_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                ) : (
                  (() => { const Icon = getCategoryIcon(vendor.category); return <Icon className="h-10 w-10 text-primary/40" />; })()
                )}
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
      <ShowMoreButton {...rec} noun="more vendors" className="mt-4" />
    </section>
  );
};

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [disputeBooking, setDisputeBooking] = useState<any | null>(null);
  const [cancelBooking, setCancelBooking] = useState<any | null>(null);
  const confirm = useConfirm();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<any>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventBudget, setNewEventBudget] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventType, setNewEventType] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const slug = searchParams.get("newEvent");
    if (slug) {
      const o = occasionBySlug(slug);
      setNewEventType(o ? o.slug : "");
      if (o) setNewEventName((n) => n || `My ${o.name.toLowerCase()}`);
      setCreateEventOpen(true);
      searchParams.delete("newEvent");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

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

  // Fetch events (used to resolve event names on bookings and for Events section)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
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
  const { data: favorites = [] } = useFavorites();
  const bookingList = useShowMore(bookings as any[], 4);
  const eventList = useShowMore(events as any[], 3);

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

  const handleCreateEvent = async () => {
    if (!newEventName.trim() || !newEventDate || !newEventLocation.trim()) {
      toast.error("Event name, date, and location are required");
      return;
    }
    setIsCreatingEvent(true);
    try {
      await api.events.create({
        name: newEventName.trim(),
        date: newEventDate,
        location: newEventLocation.trim(),
        description: newEventDesc.trim() || undefined,
        total_budget: newEventBudget ? Number(newEventBudget) : undefined,
        event_type: newEventType || undefined,
      } as any);
      toast.success("Event created! You can now book vendors for this event.");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
      setCreateEventOpen(false);
      setNewEventName(""); setNewEventDate(""); setNewEventLocation("");
      setNewEventBudget(""); setNewEventDesc(""); setNewEventType("");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to create event");
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Group bookings by event_id
  const bookingsByEvent = (bookings as any[]).reduce((acc: Record<number, any[]>, b: any) => {
    if (b.event_id) {
      if (!acc[b.event_id]) acc[b.event_id] = [];
      acc[b.event_id].push(b);
    }
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Header */}
      <DashboardHeader
        links={[{ to: "/vendor-search", label: "Find Vendors" }, { to: "/customer-dashboard", label: "Dashboard" }, { to: "/messages", label: "Messages" }]}
        displayName={user?.full_name || user?.email || "Account"}
        subtitle={user?.email}
        onLogout={handleLogout}
      />

      <section className="pt-24 sm:pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-12 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Welcome back, {user?.full_name?.split(' ')[0] || "User"}!
            </h1>
            <p className="text-muted-foreground text-lg">Manage your events and bookings from your personal command center.</p>
          </div>

          {/* Quick Stats */}
          {(() => {
            const needsConfirmation = (bookings as any[]).filter((b) => b.status === "awaiting_confirmation").length;
            return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12 animate-fade-in-up [animation-delay:200ms]">
            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Upcoming Events</p>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">
                    {statsLoading ? "..." : (stats?.upcoming_events || 0)}
                  </p>
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Awaiting Vendor</p>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-500">
                    {statsLoading ? "..." : (stats?.pending_bookings || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Vendor hasn't responded yet</p>
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-orange-500/10 rounded-2xl items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Vendor Accepted</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">
                    {statsLoading ? "..." : (stats?.confirmed_bookings || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Booked & ready for your event</p>
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-green-500/10 rounded-2xl items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className={`border p-6 hover:shadow-[var(--shadow-elevated)] transition-all ${needsConfirmation > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs sm:text-sm font-medium mb-1 ${needsConfirmation > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                    Release Payment
                  </p>
                  <p className={`text-2xl sm:text-3xl font-bold ${needsConfirmation > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {bookingsLoading ? "..." : needsConfirmation}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {needsConfirmation > 0 ? "Go to All Bookings to confirm" : "Nothing pending from you"}
                  </p>
                </div>
                <div className={`hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center ${needsConfirmation > 0 ? "bg-amber-500/10" : "bg-muted/40"}`}>
                  <CreditCard className={`h-6 w-6 ${needsConfirmation > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                </div>
              </div>
            </Card>
          </div>
            );
          })()}

          {/* Saved vendors */}
          {(favorites as any[]).length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold mb-4">Saved vendors</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(favorites as any[]).map((v) => (
                  <Link key={v.id} to={`/vendors/${v.id}`} className="snap-start flex-none w-44 rounded-2xl border border-border bg-white overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow">
                    <div className="h-24 bg-muted">
                      {(v.gallery_images?.[0] || v.profile_image_url) && <img src={thumb(v.gallery_images?.[0] || v.profile_image_url, 360)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold truncate">{v.business_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.location}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Quotes vendors sent from chat, waiting for payment */}
          {(bookings as any[]).some((b) => b.status === "awaiting_payment" && b.quote_expires_at && new Date(b.quote_expires_at) > new Date()) && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold mb-4">Quotes waiting for you</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {(bookings as any[]).filter((b) => b.status === "awaiting_payment" && b.quote_expires_at && new Date(b.quote_expires_at) > new Date())
                  .map((b) => <QuoteCard key={b.id} bookingId={b.id} role="customer" />)}
              </div>
            </section>
          )}

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
                <><div className="space-y-4">
                  {bookingList.visible.map((booking: any) => (
                    <Card key={booking.id} className="bg-white border border-border p-4 sm:p-6 rounded-2xl hover:shadow-lg transition-shadow">
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
                                booking.status === "completed" ? "bg-celebrate/10 text-celebrate hover:bg-celebrate/20" :
                                booking.status === "disputed" ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20" :
                                  "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                              {{
                                pending: "Pending",
                                confirmed: "Confirmed",
                                awaiting_confirmation: "Confirm Completion",
                                disputed: "Under Review",
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

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                          <div className="sm:text-right">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">You paid</p>
                            <p className="text-xl font-bold text-primary">{formatNaira(booking.price)}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center">
                            {(booking.status === "pending" || booking.status === "confirmed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/20 hover:bg-destructive/10"
                                onClick={() => setCancelBooking(booking)}
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
                                <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
                                  <Button
                                    size="sm"
                                    className="w-full sm:w-auto h-auto py-2.5 whitespace-normal bg-green-600 hover:bg-green-700 text-white shadow-md font-semibold"
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
                                  <button
                                    type="button"
                                    onClick={() => setDisputeBooking(booking)}
                                    className="text-[11px] font-medium text-destructive hover:underline pl-0.5 flex items-center gap-1"
                                  >
                                    <AlertTriangle className="h-3 w-3" /> Something went wrong? Report a problem
                                  </button>
                                </div>
                              );
                            })()}

                            {booking.status === "confirmed" && new Date(booking.event_date) < new Date() && (
                              <Button
                                variant="outline" size="sm"
                                className="text-destructive border-destructive/20 hover:bg-destructive/10"
                                onClick={() => setDisputeBooking(booking)}
                              >
                                <AlertTriangle className="h-4 w-4 mr-1.5" /> Vendor didn't show up?
                              </Button>
                            )}

                            {booking.resolution_note && (
                              <span className="text-xs text-muted-foreground bg-muted/60 border border-border rounded-lg px-3 py-1.5 max-w-sm">
                                <span className="font-semibold">{booking.resolution === "refund" ? "Refunded" : "Payment released"}:</span> {booking.resolution_note}
                              </span>
                            )}

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
                            {booking.status === "completed" && (
                              <Button size="sm" variant="outline" onClick={() => navigate(`/vendors/${booking.vendor_id}?book=1`)}>
                                Book again
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => api.messages.forBooking(booking.id).then((c) => navigate(`/messages/${c.id}`)).catch(() => toast.error("Couldn't open the chat."))}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                            {booking.counterpart_phone && (
                              <a href={`tel:${booking.counterpart_phone}`} className="text-sm font-medium text-primary hover:underline px-2">
                                Call vendor · {booking.counterpart_phone}
                              </a>
                            )}
                            {booking.receipt_number && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => api.documents.download(booking.id, "receipt").catch(() => toast.error("Couldn't download the receipt. Please try again."))}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Receipt
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <BookingTimeline booking={booking} role="customer" className="mt-4 pt-4 border-t border-border/70" />
                      <AddonsPanel booking={booking} role="customer" />
                    </Card>
                  ))}
                </div>
                <ShowMoreButton {...bookingList} noun="more bookings" className="mt-4" /></>
              )}
          </div>

          {/* Refund account — prominent when a refund is waiting for it */}
          <RefundAccountCard
            urgent={(bookings as any[]).some((b) => b.refund_status === "needs_details")}
            className="mt-10"
          />

          {/* Multi-Vendor Event Planning */}
          <div className="space-y-6 mt-12 animate-fade-in-up [animation-delay:600ms]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">My Events</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Plan events and manage multiple vendors in one place</p>
              </div>
              <Button onClick={() => setCreateEventOpen(true)} className="shadow-lg hover:shadow-primary/30">
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>

            {eventsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : events.length === 0 ? (
              <Card className="bg-white border-2 border-dashed border-primary/20 p-10 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-7 w-7 text-primary/60" />
                </div>
                <h3 className="text-lg font-bold mb-2">No events yet</h3>
                <p className="text-muted-foreground mb-5 max-w-sm mx-auto text-sm">
                  Create an event to coordinate multiple vendors — caterer, photographer, decorator — all under one plan.
                </p>
                <Button onClick={() => setCreateEventOpen(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" /> Create your first event
                </Button>
              </Card>
            ) : (
              <><div className="space-y-4">
                {eventList.visible.map((event: any) => {
                  const eventBookings = bookingsByEvent[event.id] || [];
                  const isExpanded = expandedEventId === event.id;
                  const totalSpent = eventBookings.reduce((s: number, b: any) => s + Number(b.price), 0);
                  const budget = event.total_budget ? Number(event.total_budget) : null;
                  return (
                    <Card key={event.id} className="bg-white border border-border overflow-hidden">
                      <button
                        className="w-full text-left px-6 py-4 hover:bg-muted/20 transition-colors flex items-start justify-between gap-4"
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-lg">{event.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              event.status === "confirmed" ? "bg-green-100 text-green-700" :
                              event.status === "completed" ? "bg-celebrate/10 text-celebrate" :
                              event.status === "cancelled" ? "bg-red-100 text-red-700" :
                              "bg-orange-100 text-orange-700"
                            }`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(event.date)}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
                            {budget && <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />Budget: ₦{budget.toLocaleString()}</span>}
                            <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{eventBookings.length} vendor{eventBookings.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {budget && (
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-muted-foreground">Spent</p>
                              <p className={`text-sm font-bold ${totalSpent > budget ? "text-destructive" : "text-green-600"}`}>
                                ₦{totalSpent.toLocaleString()} / ₦{budget.toLocaleString()}
                              </p>
                            </div>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {event.event_type && (
                        <div className="px-4 sm:px-6 pb-4">
                          <EventChecklist event={event} bookedCategories={eventBookings.map((b: any) => b.vendor_category)} />
                        </div>
                      )}

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 px-6 py-4 space-y-3">
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                          {eventBookings.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-sm text-muted-foreground mb-3">No vendors booked for this event yet</p>
                              <Link to={`/vendor-search?event_id=${event.id}`}>
                                <Button size="sm" variant="outline">
                                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Browse Vendors
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendors Booked</p>
                              {eventBookings.map((b: any) => (
                                <div key={b.id} className="flex items-center justify-between bg-white rounded-lg border border-border px-4 py-2.5 text-sm">
                                  <div>
                                    <span className="font-medium">{b.vendor_name}</span>
                                    {b.vendor_category && <span className="text-xs text-muted-foreground ml-2 capitalize">({b.vendor_category})</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium text-primary">{formatNaira(b.price)}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      b.status === "confirmed" ? "bg-green-100 text-green-700" :
                                      b.status === "pending" ? "bg-orange-100 text-orange-700" :
                                      b.status === "completed" ? "bg-celebrate/10 text-celebrate" :
                                      "bg-gray-100 text-gray-600"
                                    }`}>{b.status}</span>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-between items-center border-t border-border pt-2 text-sm">
                                <span className="font-medium">Total Committed</span>
                                <span className="font-bold text-primary">₦{totalSpent.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end pt-1">
                            <Link to={`/vendor-search?event_id=${event.id}`}>
                              <Button size="sm" className="h-8 text-xs">
                                <Plus className="h-3 w-3 mr-1.5" /> Add Vendor
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
              <ShowMoreButton {...eventList} noun="more events" className="mt-4" /></>
            )}
          </div>

          {/* Create Event Dialog */}
          <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Set up an event to manage multiple vendors in one place.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>What are you celebrating?</Label>
                  <select value={newEventType} onChange={(e) => setNewEventType(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                    <option value="">Something else</option>
                    {OCCASIONS.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                  </select>
                  {newEventType && <p className="text-xs text-muted-foreground">We'll add a {occasionBySlug(newEventType)?.name.toLowerCase()} checklist and the vendors you'll need.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Event Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Sarah's Birthday Party" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Event Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Total Budget (₦)</Label>
                    <Input type="number" placeholder="500000" value={newEventBudget} onChange={(e) => setNewEventBudget(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Location / Venue <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Lekki, Lagos" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="Event details, theme, guest count..." rows={3} value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} className="resize-none" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setCreateEventOpen(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleCreateEvent} disabled={isCreatingEvent}>
                    {isCreatingEvent ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Event"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Recommended Vendors */}
          <RecommendedVendors />

          <CancelBookingDialog
            booking={cancelBooking}
            onClose={() => setCancelBooking(null)}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["bookings"] });
              queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
            }}
          />

          <ReportProblemDialog
            booking={disputeBooking}
            onClose={() => setDisputeBooking(null)}
            onReported={() => {
              queryClient.invalidateQueries({ queryKey: ["bookings"] });
              queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
            }}
          />

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
                      detailBooking.status === "completed" ? "bg-celebrate/10 text-celebrate" :
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
                    <div className="font-bold text-primary">{formatNaira(detailBooking.price)}</div>
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
                            <span className="font-medium">{formatNaira(s.subtotal)}</span>
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
