import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, Mail, Phone, MapPin, DollarSign, FileText,
  LogOut, ArrowLeft, Loader2, CheckCircle2, Clock, XCircle,
  User, Settings, Star, ShieldCheck, RefreshCw
} from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const VendorProfile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-profile"],
    queryFn: () => api.vendors.getMyVendor(),
    enabled: !!user && user.role === "vendor",
  });

  const { data: ratingData } = useQuery({
    queryKey: ["vendor-rating", vendor?.id],
    queryFn: () => api.reviews.getVendorRating(vendor!.id),
    enabled: !!vendor,
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates: Record<string, any> = {};
    ["description", "location", "starting_price", "business_size", "registration_number"].forEach((k) => {
      const v = fd.get(k) as string;
      if (v !== null && v !== "") updates[k] = k === "starting_price" ? Number(v) : v;
    });

    setIsSaving(true);
    try {
      await api.vendors.updateMyVendor(updates);
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const account_number = fd.get("account_number") as string;
    const bank_code = fd.get("bank_code") as string;
    if (!account_number || !bank_code) {
      toast.error("Please fill in all bank details");
      return;
    }
    setIsSavingBank(true);
    try {
      await api.vendors.updateMyVendor({ account_number, bank_code });
      toast.success("Bank details saved!");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to save bank details");
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleReVerify = async () => {
    setIsVerifying(true);
    try {
      const data = await api.vendors.reVerify();
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
      if (data.cac?.verified) {
        toast.success(`Verified! Matched CAC record: "${data.cac.cac_verified_name}"`);
      } else if (data.cac?.found) {
        toast.warning(`RC found but name mismatch. CAC record: "${data.cac.cac_verified_name}". Pending manual review.`);
      } else {
        toast.error("RC number not found in CAC database. Please check your registration number.");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Verification failed. Try again later.");
    } finally {
      setIsVerifying(false);
    }
  };

  const verificationBadge = () => {
    if (!vendor) return null;
    const status = vendor.verification_status;
    if (status === "approved") return (
      <Badge className="bg-green-500/10 text-green-700 border-green-500/20 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </Badge>
    );
    if (status === "pending") return (
      <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 gap-1">
        <Clock className="h-3 w-3" /> Pending Review
      </Badge>
    );
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
        <XCircle className="h-3 w-3" /> Not Verified
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-12" />
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/vendor-dashboard">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2">
                  <ArrowLeft className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-accent text-white flex items-center justify-center font-bold text-xs">
                    {user.business_name?.[0] || user.full_name?.[0] || "V"}
                  </div>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">
                    {user.business_name || user.full_name}
                  </span>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">

          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !vendor ? (
            <div className="text-center py-32">
              <p className="text-muted-foreground mb-4">Vendor profile not found.</p>
              <Link to="/vendor-dashboard"><Button>Back to Dashboard</Button></Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile header card */}
              <div className="bg-white border border-border rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-glow rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-sm">
                    {vendor.business_name?.[0] || "V"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <h1 className="text-xl font-bold text-foreground truncate">{vendor.business_name}</h1>
                      {verificationBadge()}
                    </div>
                    <p className="text-muted-foreground text-sm capitalize mb-3">{vendor.category}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> {vendor.location}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {ratingData?.average_rating > 0 ? ratingData.average_rating.toFixed(1) : "No ratings yet"}
                        {ratingData?.total_reviews > 0 && ` (${ratingData.total_reviews} reviews)`}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" /> From ₦{Number(vendor.starting_price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Business Info */}
                <div className="bg-white border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">Business Information</h2>
                  </div>

                  <div className="space-y-3 text-sm">
                    {[
                      { icon: User, label: "Contact Name", value: vendor.contact_name },
                      { icon: Mail, label: "Email", value: vendor.email || user?.email },
                      { icon: Phone, label: "Phone", value: vendor.phone_number },
                      { icon: FileText, label: "Registration Number", value: vendor.registration_number || "—" },
                      { icon: Building2, label: "Business Size", value: vendor.business_size ? `${vendor.business_size.charAt(0).toUpperCase()}${vendor.business_size.slice(1)} Scale` : "—" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium text-foreground">{value || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edit Profile */}
                <div className="bg-white border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                      <Settings className="h-4 w-4 text-accent" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">Edit Profile</h2>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Description</label>
                      <Textarea
                        name="description"
                        defaultValue={vendor.description || ""}
                        placeholder="Describe your services..."
                        rows={3}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Location</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input name="location" defaultValue={vendor.location} placeholder="City, State" className="pl-9 text-sm h-10" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Starting Price (₦)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input name="starting_price" type="number" defaultValue={vendor.starting_price} placeholder="50000" className="pl-9 text-sm h-10" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Business Size</label>
                      <Select name="business_size" defaultValue={vendor.business_size || "small"}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small Scale</SelectItem>
                          <SelectItem value="medium">Medium Scale</SelectItem>
                          <SelectItem value="large">Large Scale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">CAC RC Number</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input name="registration_number" defaultValue={vendor.registration_number || ""} placeholder="e.g. RC1234567" className="pl-9 text-sm h-10" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-10 font-semibold" disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                  </form>

                  {/* CAC Re-verify */}
                  {vendor.verification_status !== "approved" && vendor.registration_number && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">
                        {vendor.cac_verified_name
                          ? `Last CAC check: "${vendor.cac_verified_name}" — mismatch with your business name.`
                          : "Run CAC verification to get approved automatically."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                        disabled={isVerifying}
                        onClick={handleReVerify}
                      >
                        {isVerifying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Run CAC Verification</>
                        )}
                      </Button>
                    </div>
                  )}
                  {vendor.verification_status === "approved" && vendor.cac_verified_name && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-green-700 bg-green-500/8 border border-green-500/20 px-3 py-2 rounded-lg">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified via CAC — matched "{vendor.cac_verified_name}"
                    </div>
                  )}
                </div>

                {/* Payout Settings */}
                <div className="bg-white border border-border rounded-2xl p-6 lg:col-span-2">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Payout Settings</h2>
                      <p className="text-xs text-muted-foreground">Bank details for receiving payments</p>
                    </div>
                  </div>

                  <form onSubmit={handleBankSubmit} className="grid sm:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Bank Name</label>
                      <select
                        name="bank_code"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        defaultValue={vendor.bank_code || ""}
                      >
                        <option value="">Select Bank</option>
                        <option value="044">Access Bank</option>
                        <option value="058">Guaranty Trust Bank</option>
                        <option value="033">United Bank for Africa</option>
                        <option value="057">Zenith Bank</option>
                        <option value="011">First Bank of Nigeria</option>
                        <option value="076">Polaris Bank</option>
                        <option value="221">Stanbic IBTC Bank</option>
                        <option value="232">Sterling Bank</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Account Number</label>
                      <Input
                        type="text"
                        name="account_number"
                        placeholder="0123456789"
                        defaultValue={vendor.account_number || ""}
                        maxLength={10}
                        className="h-10 text-sm"
                      />
                    </div>
                    <Button type="submit" variant="outline" className="h-10 font-semibold" disabled={isSavingBank}>
                      {isSavingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Bank Details"}
                    </Button>
                  </form>

                  {vendor.bank_code && vendor.account_number && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-green-700 bg-green-500/8 border border-green-500/20 px-3 py-2 rounded-lg w-fit">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Bank details saved — payouts are enabled
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VendorProfile;
