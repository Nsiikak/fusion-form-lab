import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Footer } from "@/components/Footer";
import {
  Calendar,
  Banknote,
  Star,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  LogOut,
  Loader2,
  Settings,
  Package,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Info,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/common/DashboardHeader";
import BookingTimeline from "@/components/common/BookingTimeline";
import { ShowMoreButton, useShowMore } from "@/components/common/ShowMore";
import AddonsPanel from "@/components/common/AddonsPanel";
import VendorShareKit from "@/components/common/VendorShareKit";
import { NoShowResponseDialog, VendorCancelDialog } from "@/components/common/CancellationDialogs";
import { FileText, MessageCircle } from "lucide-react";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import WalletCard from "@/components/common/WalletCard";
import { toast } from "sonner";
import { format } from "date-fns";

const bookingRef = (id: number) =>
  `PLG-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;

const VendorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailBooking, setDetailBooking] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("bookings");

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
  const bookingList = useShowMore(bookings as any[], 4);

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

  // Check service items for setup completeness
  const { data: myServiceItems = [] } = useQuery({
    queryKey: ["my-service-items"],
    queryFn: () => api.serviceItems.getMine(),
    enabled: !!vendorProfile,
    staleTime: 60_000,
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

  // Re-verify CAC mutation
  const reVerifyMutation = useMutation({
    mutationFn: () => api.vendors.reVerify(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
      if (data.cac?.verified) {
        toast.success(`Business verified! Matched CAC record: "${data.cac.cac_verified_name}"`);
      } else if (data.cac?.found) {
        toast.warning(`RC number found but name mismatch. CAC record: "${data.cac.cac_verified_name}". Our team will review manually.`);
      } else {
        toast.error("RC number not found in CAC database. Please check and update your profile.");
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Verification failed. Please try again later.");
    },
  });

  const handleAccept = (bookingId: number) => {
    updateBookingStatus.mutate({ bookingId, status: "confirmed" });
  };

  const confirm = useConfirm();
  const [vendorCancelBooking, setVendorCancelBooking] = useState<any | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<any | null>(null);
  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Something went wrong. Please try again.");
    }
  };

  const handleDecline = async (bookingId: number) => {
    const ok = await confirm({
      title: "Decline this booking?",
      description: "The customer will be refunded in full and notified. This can't be undone.",
      confirmText: "Decline booking",
      cancelText: "Go back",
      tone: "danger",
    });
    if (ok) updateBookingStatus.mutate({ bookingId, status: "declined" });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      {/* Header */}
      <DashboardHeader
        links={[{ to: "/vendor-dashboard", label: "Dashboard" }, { to: "/messages", label: "Messages" }, { to: "/profile", label: "Profile" }]}
        displayName={vendorProfile?.business_name || user?.full_name || "Vendor"}
        subtitle={user?.email}
        onLogout={handleLogout}
      />

      <section className="pt-24 sm:pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Welcome Section */}
          <div className="mb-12 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  Vendor Dashboard
                </h1>
                <p className="text-muted-foreground text-lg">
                  Welcome back, <span className="font-semibold text-foreground">{user?.full_name || "Vendor"}</span>
                </p>
              </div>
              <Link to="/profile">
                <Button className="shadow-lg hover:shadow-primary/30 bg-primary hover:bg-primary/90 text-white">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Admin decision banner — rejected or paused, with the reason */}
          {vendorProfile && (vendorProfile.verification_status === "rejected" || vendorProfile.is_active === false) && (
            <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {vendorProfile.is_active === false ? "Your listing is paused" : "We couldn't verify your business yet"}
                </p>
                {vendorProfile.verification_note && (
                  <p className="text-xs text-muted-foreground mt-0.5">Reason: {vendorProfile.verification_note}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Customers can't find or book you right now. Update your <Link to="/profile" className="underline">profile</Link> and reply to our email when you're ready for another look.
                </p>
              </div>
            </div>
          )}

          {/* CAC Verification Banner — three distinct states */}
          {vendorProfile && vendorProfile.verification_status === "pending" && vendorProfile.is_active !== false && (() => {
            const attempted = vendorProfile.cac_verification_attempted;
            const hasNameMatch = !!vendorProfile.cac_verified_name;

            if (!attempted) {
              return (
                <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Complete your verification</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Add your CAC RC number in your profile to get verified instantly and unlock full platform access.</p>
                    </div>
                  </div>
                  <Link to="/profile" className="flex-shrink-0">
                    <Button size="sm" className="text-xs h-8">Add RC Number</Button>
                  </Link>
                </div>
              );
            }

            if (attempted && hasNameMatch) {
              return (
                <div className="mb-8 rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Under manual review</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        CAC record found as <span className="font-medium text-foreground">"{vendorProfile.cac_verified_name}"</span>. Our team is reviewing the name difference — no action needed from you.
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-medium text-yellow-700 bg-yellow-100 border border-yellow-200 px-3 py-1.5 rounded-full">Review in progress</span>
                </div>
              );
            }

            return (
              <div className="mb-8 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">RC number not found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">We couldn't match your RC number in the CAC database. Please check it's correct, update your profile, then retry.</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link to="/profile">
                    <Button size="sm" variant="outline" className="text-xs h-8">Update RC Number</Button>
                  </Link>
                  {vendorProfile.registration_number && (
                    <Button size="sm" className="text-xs h-8" disabled={reVerifyMutation.isPending} onClick={() => reVerifyMutation.mutate()}>
                      {reVerifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</>}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Setup Checklist — shown until all steps complete */}
          {vendorProfile && (() => {
            const hasBankDetails = !!(vendorProfile.account_number);
            const hasServiceItems = (myServiceItems as any[]).length > 0;
            const steps = [
              {
                id: "services",
                label: "Add your service items & pricing",
                desc: "Let customers pick exactly what they need — rice, DJ set, cocktails per person, etc.",
                done: hasServiceItems,
                cta: "Add Services",
                action: () => navigate("/profile#services"),
              },
              {
                id: "payouts",
                label: "Set up bank details for payouts",
                desc: "Required to receive payment when bookings complete. Without this, you can't get paid.",
                done: hasBankDetails,
                cta: "Set Up Payouts",
                action: () => navigate("/profile#payouts"),
              },
            ];
            const completedCount = steps.filter(s => s.done).length;
            const allDone = completedCount === steps.length;
            if (allDone) return null;
            const remaining = steps.length - completedCount;

            return (
              <div className="mb-8 rounded-2xl border border-primary/20 overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 to-accent/5 px-5 py-4 flex items-center justify-between border-b border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {remaining === 1 ? "One last step" : `${remaining} steps left`} before you're ready to earn
                      </p>
                      <p className="text-xs text-muted-foreground">Complete your setup to start receiving bookings and getting paid</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-4">
                    <div className="w-20 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] rounded-full transition-all duration-700"
                        style={{ width: `${(completedCount / steps.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-primary whitespace-nowrap">{completedCount}/{steps.length}</span>
                  </div>
                </div>

                {/* Step rows */}
                <div className="bg-white divide-y divide-border">
                  {steps.map((step) => (
                    <div key={step.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 px-4 sm:px-5 py-4 transition-colors ${step.done ? "bg-muted/20" : "hover:bg-primary/5"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? "bg-green-500/10" : "bg-primary/10"}`}>
                        {step.done
                          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                          : <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0 basis-[calc(100%-3rem)] sm:basis-auto">
                        <p className={`text-sm font-semibold ${step.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}>
                          {step.label}
                        </p>
                        {!step.done && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                        )}
                      </div>
                      {!step.done && step.action && (
                        <Button size="sm" className="flex-shrink-0 h-9 sm:h-8 text-xs gap-1.5 ml-12 sm:ml-0" onClick={step.action}>
                          {step.cta}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <WalletCard className="mb-6 sm:mb-8 animate-fade-in-up [animation-delay:150ms]" />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12 animate-fade-in-up [animation-delay:200ms]">
            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Earnings</p>
                  {statsLoading ? (
                    <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl sm:text-3xl font-bold text-primary">
                      {formatNaira(stats?.total_earnings || 0)}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center shadow-sm">
                  <Banknote className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Bookings</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl sm:text-3xl font-bold text-accent">
                      {stats?.total_bookings || 0}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-accent/10 rounded-2xl items-center justify-center shadow-sm">
                  <Package className="h-6 w-6 text-accent" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Rating</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl sm:text-3xl font-bold text-yellow-500">
                      {(stats?.average_rating ?? 0) > 0 ? Number(stats!.average_rating).toFixed(1) : "N/A"}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-yellow-400/10 rounded-2xl items-center justify-center shadow-sm">
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-border p-4 sm:p-6 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Customers</p>
                  {statsLoading ? (
                    <div className="h-9 w-16 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl sm:text-3xl font-bold text-celebrate">
                      {stats?.total_clients || 0}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex w-12 h-12 bg-celebrate/10 rounded-2xl items-center justify-center shadow-sm">
                  <TrendingUp className="h-6 w-6 text-celebrate" />
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 animate-fade-in-up [animation-delay:400ms]">
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
                <Card className="bg-white border-2 border-dashed border-primary/20 p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Package className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">When customers book your services, they will appear here.</p>
                </Card>
              ) : (
                <><div className="space-y-4">
                  {bookingList.visible.map((booking: any) => (
                    <Card key={booking.id} className="bg-white border border-border p-4 sm:p-6 rounded-2xl hover:shadow-lg transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold text-foreground font-mono">{bookingRef(booking.id)}</h3>
                            <Badge
                              className={`${booking.status === "confirmed" ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" :
                                booking.status === "pending" ? "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20" :
                                booking.status === "awaiting_confirmation" ? "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20" :
                                booking.status === "completed" ? "bg-celebrate/10 text-celebrate hover:bg-celebrate/20" :
                                booking.status === "disputed" ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20" :
                                  "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                }`}
                            >
                              {booking.status === "confirmed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                              {booking.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {booking.status === "awaiting_confirmation" && <Clock className="h-3 w-3 mr-1" />}
                              {{
                                pending: "Pending",
                                confirmed: "Confirmed",
                                awaiting_confirmation: "Waiting for Customer",
                                disputed: "Under Review",
                                completed: "Completed",
                                declined: "Declined",
                                cancelled: "Cancelled",
                              }[booking.status] ?? booking.status}
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
                              {booking.customer_name || "Customer"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                          <div className="sm:text-right">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your payout</p>
                            <p className="text-xl font-bold text-primary">{formatNaira(booking.payout_amount ?? booking.price)}</p>
                            <p className="text-xs text-muted-foreground">of {formatNaira(booking.price)} booking</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
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
                            {booking.status === "confirmed" && (() => {
                              const start = new Date(booking.event_date).getTime();
                              const now = Date.now();
                              const eventPassed = start <= now;
                              const withinWeek = start - now <= 7 * 86400_000;
                              const checkInOpen = start - now <= 6 * 3600_000;
                              return (
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  {withinWeek && !booking.reconfirmed_at && !eventPassed && (
                                    <Button size="sm" onClick={() => runAction(() => api.bookings.reconfirm(booking.id), "Reconfirmed — the customer has been told you're all set.")}
                                      className="bg-celebrate-emerald hover:bg-celebrate-emerald/90 text-white">
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Reconfirm
                                    </Button>
                                  )}
                                  {checkInOpen && !booking.checked_in_at && (
                                    <Button size="sm" onClick={() => runAction(() => api.bookings.checkIn(booking.id), "Checked in. Have a great event!")}
                                      className="bg-celebrate-emerald hover:bg-celebrate-emerald/90 text-white">
                                      <MapPin className="h-4 w-4 mr-1" /> I've arrived
                                    </Button>
                                  )}
                                  {booking.checked_in_at && (
                                    <span className="text-xs font-medium text-celebrate-emerald flex items-center gap-1">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Checked in
                                    </span>
                                  )}
                                  {eventPassed && (
                                    <Button size="sm" onClick={() => updateBookingStatus.mutate({ bookingId: booking.id, status: "awaiting_confirmation" })}
                                      disabled={updateBookingStatus.isPending} className="bg-celebrate hover:bg-celebrate/90 text-white">
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark complete
                                    </Button>
                                  )}
                                  {!eventPassed && (
                                    <button type="button" onClick={() => setVendorCancelBooking(booking)}
                                      className="text-xs text-muted-foreground hover:text-destructive underline-offset-4 hover:underline px-1">
                                      Can't make it?
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                            {booking.status === "disputed" && booking.dispute_kind === "no_show" && !booking.vendor_responded_at && (
                              <Button size="sm" variant="destructive" onClick={() => setNoShowBooking(booking)}>
                                <AlertTriangle className="h-4 w-4 mr-1" /> Respond to no-show report
                              </Button>
                            )}
                            {booking.counterpart_phone && (
                              <a href={`tel:${booking.counterpart_phone}`} className="text-xs font-medium text-primary hover:underline">
                                Call customer · {booking.counterpart_phone}
                              </a>
                            )}
                            {booking.status === "disputed" && (
                              <div className="sm:max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                                <p className="font-semibold text-amber-800 mb-0.5">What the customer told us</p>
                                {booking.dispute_reason && <p className="text-foreground/80 line-clamp-3">"{booking.dispute_reason}"</p>}
                                <p className="text-muted-foreground mt-1">Reply to our email with any evidence. We'll decide within 2 working days.</p>
                              </div>
                            )}
                            {booking.resolution_note && booking.status !== "disputed" && (
                              <p className="max-w-xs text-xs text-muted-foreground">
                                <span className="font-semibold">{booking.resolution === "refund" ? "Refunded to customer" : "Payout released"}:</span> {booking.resolution_note}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/20 hover:bg-primary/5"
                              onClick={() => setDetailBooking(booking)}
                            >
                              <Info className="h-3.5 w-3.5 mr-1" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => api.messages.forBooking(booking.id).then((c) => navigate(`/messages/${c.id}`)).catch(() => toast.error("Couldn't open the chat."))}
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1" />
                              Message
                            </Button>
                            {["processing", "awaiting_otp", "paid", "credited"].includes(booking.payout_status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => api.documents.download(booking.id, "payout-statement").catch(() => toast.error("Couldn't download the statement. Please try again."))}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Statement
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <BookingTimeline booking={booking} role="vendor" className="mt-4 pt-4 border-t border-border/70" />
                      <AddonsPanel booking={booking} role="vendor" />
                    </Card>
                  ))}
                </div>
                <ShowMoreButton {...bookingList} noun="more bookings" className="mt-4" /></>
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
                <Card className="bg-white border-2 border-dashed border-primary/20 p-12 text-center">
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
                          <h3 className="font-bold mb-1 text-foreground">{review.customer_name || "Verified Customer"}</h3>
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
              {/* Prices, logistics and availability live on the profile page */}
              <Card className="bg-white border border-border p-6">
                <h2 className="text-2xl font-bold mb-2 text-foreground">Prices, logistics and availability</h2>
                <p className="text-muted-foreground mb-4">Set your services and prices, your logistics fee (in your state and for other states), the days you're available and your preparation advance on your profile.</p>
                <Button onClick={() => navigate("/profile")}>Open my profile</Button>
              </Card>

              <Card className="bg-white border border-border p-6">
                <h2 className="text-2xl font-bold mb-6 text-foreground">Payout Settings</h2>
                <p className="text-muted-foreground mb-6">Enter your bank details so you can withdraw your wallet balance to your bank.</p>

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
                      <option value="023">Citibank Nigeria</option>
                      <option value="050">Ecobank Nigeria</option>
                      <option value="070">Fidelity Bank</option>
                      <option value="214">First City Monument Bank (FCMB)</option>
                      <option value="011">First Bank of Nigeria</option>
                      <option value="058">Guaranty Trust Bank (GTB)</option>
                      <option value="030">Heritage Bank</option>
                      <option value="301">Jaiz Bank</option>
                      <option value="082">Keystone Bank</option>
                      <option value="50211">Kuda Bank</option>
                      <option value="50515">Moniepoint MFB</option>
                      <option value="999992">OPay</option>
                      <option value="999991">PalmPay</option>
                      <option value="076">Polaris Bank</option>
                      <option value="526">Parallex Bank</option>
                      <option value="101">ProvidusBank</option>
                      <option value="221">Stanbic IBTC Bank</option>
                      <option value="068">Standard Chartered Bank</option>
                      <option value="232">Sterling Bank</option>
                      <option value="100">SunTrust Bank</option>
                      <option value="032">Union Bank of Nigeria</option>
                      <option value="033">United Bank for Africa (UBA)</option>
                      <option value="215">Unity Bank</option>
                      <option value="035">Wema Bank</option>
                      <option value="057">Zenith Bank</option>
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

          {/* Share kit: verified card and stats card for socials */}
          <section className="mt-12">
            <VendorShareKit vendor={vendorProfile} stats={stats} />
          </section>

          {/* Performance Analytics */}
          <section className="mt-12 pb-8">
            <Card className="bg-white border border-border p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Performance Overview</h2>
                  <p className="text-sm text-muted-foreground mt-1">Based on your booking history and activity</p>
                </div>
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs px-3 py-1.5 w-fit">
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Live data
                </Badge>
              </div>

              {statsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-8">

                  {/* Insight Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 30-Day Growth */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">30-Day Growth</p>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-foreground">
                          {Math.abs(stats?.growth_percentage ?? 0)}%
                        </span>
                        <span className={`flex items-center text-sm font-semibold mb-0.5 ${(stats?.growth_percentage ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {(stats?.growth_percentage ?? 0) >= 0
                            ? <ArrowUp className="h-4 w-4" />
                            : <ArrowDown className="h-4 w-4" />}
                          vs last month
                        </span>
                      </div>
                    </div>

                    {/* Avg Booking Value */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/10">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Avg Booking Value</p>
                      <span className="text-3xl font-bold text-foreground">
                        ₦{(stats?.total_bookings ?? 0) > 0
                          ? Math.round((stats?.total_earnings ?? 0) / stats!.total_bookings).toLocaleString()
                          : "0"}
                      </span>
                    </div>

                    {/* Acceptance Rate */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/5 to-green-500/10 border border-green-500/10">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Acceptance Rate</p>
                      <span className="text-3xl font-bold text-foreground">
                        {(() => {
                          const accepted = bookings.filter((b: any) =>
                            ["confirmed", "completed", "awaiting_confirmation"].includes(b.status)
                          ).length;
                          const decided = bookings.filter((b: any) =>
                            ["confirmed", "completed", "awaiting_confirmation", "declined"].includes(b.status)
                          ).length;
                          return decided > 0 ? `${Math.round((accepted / decided) * 100)}%` : "N/A";
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Booking Status Distribution */}
                  {bookings.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-3">Booking Status Breakdown</p>
                      {(() => {
                        const counts = {
                          pending: bookings.filter((b: any) => b.status === "pending").length,
                          confirmed: bookings.filter((b: any) => b.status === "confirmed").length,
                          awaiting: bookings.filter((b: any) => b.status === "awaiting_confirmation").length,
                          completed: bookings.filter((b: any) => b.status === "completed").length,
                          declined: bookings.filter((b: any) => b.status === "declined").length,
                          cancelled: bookings.filter((b: any) => b.status === "cancelled").length,
                        };
                        const total = bookings.length;
                        const segments = [
                          { key: "pending",   color: "bg-orange-400", label: "Pending",    count: counts.pending },
                          { key: "confirmed", color: "bg-green-500",  label: "Confirmed",  count: counts.confirmed },
                          { key: "awaiting",  color: "bg-purple-500", label: "Awaiting",   count: counts.awaiting },
                          { key: "completed", color: "bg-celebrate",   label: "Completed",  count: counts.completed },
                          { key: "declined",  color: "bg-red-400",    label: "Declined",   count: counts.declined },
                          { key: "cancelled", color: "bg-gray-300",   label: "Cancelled",  count: counts.cancelled },
                        ].filter(s => s.count > 0);
                        return (
                          <>
                            <div className="flex rounded-full overflow-hidden h-3 gap-0.5 mb-3">
                              {segments.map(s => (
                                <div
                                  key={s.key}
                                  className={`${s.color} transition-all duration-700`}
                                  style={{ width: `${(s.count / total) * 100}%` }}
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {segments.map(s => (
                                <span key={s.key} className="flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.color}`} />
                                  {s.label} <span className="font-semibold text-foreground ml-0.5">({s.count})</span>
                                </span>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Monthly Activity Chart */}
                  {bookings.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-4">Monthly Booking Activity</p>
                      {(() => {
                        const months = Array.from({ length: 6 }, (_, i) => {
                          const d = new Date();
                          d.setDate(1);
                          d.setMonth(d.getMonth() - (5 - i));
                          const year = d.getFullYear();
                          const month = d.getMonth();
                          const label = d.toLocaleString("default", { month: "short" });
                          const bks = bookings.filter((b: any) => {
                            const bd = new Date(b.created_at);
                            return bd.getFullYear() === year && bd.getMonth() === month;
                          });
                          return { label, count: bks.length };
                        });
                        const maxCount = Math.max(...months.map(m => m.count), 1);
                        return (
                          <div className="flex items-end gap-2 sm:gap-3 h-36">
                            {months.map((m, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-foreground h-4">
                                  {m.count > 0 ? m.count : ""}
                                </span>
                                <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                                  <div
                                    className="w-full rounded-t-md bg-gradient-to-t from-primary to-[hsl(var(--primary-glow))] transition-all duration-700"
                                    style={{
                                      height: `${Math.max((m.count / maxCount) * 80, m.count > 0 ? 6 : 0)}px`,
                                      opacity: m.count > 0 ? 1 : 0,
                                    }}
                                  />
                                  {m.count === 0 && (
                                    <div className="w-full rounded-t-md bg-muted" style={{ height: "4px" }} />
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Coming Soon Teaser */}
                  <div className="border border-dashed border-primary/20 rounded-2xl p-5 bg-gradient-to-r from-primary/5 to-accent/5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground mb-1">More Powerful Insights Coming Soon</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          We're building deeper analytics to help you understand your business and grow faster.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {["Revenue forecasting", "Peak season insights", "Customer retention", "Category benchmarks", "Response time tracking"].map(f => (
                            <span key={f} className="text-xs bg-white text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </Card>
          <VendorCancelDialog booking={vendorCancelBooking} onClose={() => setVendorCancelBooking(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })} />
      <NoShowResponseDialog booking={noShowBooking} onClose={() => setNoShowBooking(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })} />
      </section>
        </div>
      </section>

      {/* Booking Detail Modal */}
      <Dialog open={!!detailBooking} onOpenChange={(open) => !open && setDetailBooking(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {detailBooking && (
            <div className="space-y-4 pt-2">
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
                <div className="text-muted-foreground">Customer</div>
                <div className="font-medium">{detailBooking.customer_name || "—"}</div>

                <div className="text-muted-foreground">Event Date</div>
                <div className="font-medium">{formatDate(detailBooking.event_date)}</div>

                {detailBooking.event_time && (
                  <>
                    <div className="text-muted-foreground">Event Time</div>
                    <div className="font-medium">{formatTime(detailBooking.event_time)}</div>
                  </>
                )}

                <div className="text-muted-foreground">Payment</div>
                <div className="flex items-center gap-1 font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                </div>

                <div className="text-muted-foreground">Booking amount</div>
                <div className="font-medium">{formatNaira(detailBooking.price)}</div>

                {detailBooking.commission_amount != null && (
                  <>
                    <div className="text-muted-foreground">Plagohive commission</div>
                    <div className="font-medium text-muted-foreground">−{formatNaira(detailBooking.commission_amount)}</div>
                  </>
                )}

                <div className="text-muted-foreground">Your payout</div>
                <div className="font-bold text-primary">
                  {formatNaira(detailBooking.payout_amount ?? detailBooking.price)}
                  {detailBooking.payout_status && detailBooking.payout_status !== "not_due" && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      {{
                        awaiting_approval: "· being reviewed, usually within 1 working day",
                        awaiting_otp: "· transfer in progress",
                        processing: "· transfer in progress",
                        paid: "· paid out",
                        credited: "· in your wallet",
                        failed: "· delayed — our team is on it",
                      }[detailBooking.payout_status as string]}
                    </span>
                  )}
                </div>
              </div>

              {detailBooking.service_items_snapshot && detailBooking.service_items_snapshot.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/50 border-b border-border">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services Ordered</p>
                  </div>
                  <div className="divide-y divide-border">
                    {detailBooking.service_items_snapshot.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                        <span>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer Notes</p>
                  <p className="bg-muted/30 rounded-lg px-3 py-2">{detailBooking.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t">
                <Button className="w-full" onClick={() => setDetailBooking(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDashboard;
