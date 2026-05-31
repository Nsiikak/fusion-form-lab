import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Building2, Mail, Phone, MapPin, Banknote, FileText,
  LogOut, ArrowLeft, Loader2, CheckCircle2, Clock, XCircle,
  User, Settings, Star, ShieldCheck, RefreshCw, Camera, Upload,
  Image as ImageIcon, X, Utensils, Palette, Music, Truck,
  Plus, Pencil, Trash2, Package, ToggleLeft, ToggleRight, AlertTriangle
} from "lucide-react";

const categoryIconMap: Record<string, React.ElementType> = {
  catering: Utensils,
  decoration: Palette,
  photography: Camera,
  entertainment: Music,
  logistics: Truck,
  venue: Building2,
};

const getCategoryIcon = (category: string): React.ElementType =>
  categoryIconMap[category] || Building2;
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const VendorProfile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll to section when navigated via hash (e.g. /profile#payouts)
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      }
    }
  }, [location.hash]);

  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Digital banks that Paystack's /bank/resolve doesn't support via NIBSS
  const UNRESOLVABLE_BANKS = new Set(["100004", "999992", "999991", "090110", "090267", "565"]);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  // Service items state
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ name: "", description: "", unit_price: "", unit_label: "each" });

  const { data: serviceItems = [], isLoading: serviceItemsLoading } = useQuery({
    queryKey: ["my-service-items"],
    queryFn: () => api.serviceItems.getMine(),
    enabled: !!vendor,
  });

  // Sync bank state when vendor profile loads
  useEffect(() => {
    if (vendor) {
      setBankCode(vendor.bank_code || "");
      setAccountNumber(vendor.account_number || "");
    }
  }, [vendor?.id]);

  // Auto-resolve account name when 10-digit account + bank code are set
  useEffect(() => {
    if (accountNumber.length !== 10 || !bankCode) {
      setResolvedName(null);
      setResolveError(null);
      return;
    }
    // Digital banks (OPay, Kuda, PalmPay, etc.) don't support NIBSS resolution
    if (UNRESOLVABLE_BANKS.has(bankCode)) {
      setResolvedName(null);
      setResolveError(null);
      return;
    }
    let cancelled = false;
    setIsResolving(true);
    setResolvedName(null);
    setResolveError(null);
    api.vendors.resolveAccount(accountNumber, bankCode)
      .then((data) => {
        if (!cancelled) {
          setResolvedName(data.account_name);
          setIsResolving(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setResolveError(err.response?.data?.detail || "Could not verify this account. Please check your details.");
          setIsResolving(false);
        }
      });
    return () => { cancelled = true; };
  }, [accountNumber, bankCode]);

  const createItemMutation = useMutation({
    mutationFn: (data: any) => api.serviceItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-service-items"] });
      setShowAddItem(false);
      setItemForm({ name: "", description: "", unit_price: "", unit_label: "each" });
      toast.success("Service item added");
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to add item"),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.serviceItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-service-items"] });
      setEditingItem(null);
      toast.success("Item updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to update item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => api.serviceItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-service-items"] });
      toast.success("Item removed");
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to delete item"),
  });

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(itemForm.unit_price);
    if (!itemForm.name.trim() || isNaN(price) || price <= 0) {
      toast.error("Please enter a valid name and price");
      return;
    }
    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || undefined,
      unit_price: price,
      unit_label: itemForm.unit_label,
    };
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createItemMutation.mutate(payload);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      unit_price: String(item.unit_price),
      unit_label: item.unit_label,
    });
    setShowAddItem(true);
  };

  const cancelItemForm = () => {
    setShowAddItem(false);
    setEditingItem(null);
    setItemForm({ name: "", description: "", unit_price: "", unit_label: "each" });
  };

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
    if (!accountNumber || !bankCode) {
      toast.error("Please fill in all bank details");
      return;
    }
    setIsSavingBank(true);
    try {
      await api.vendors.updateMyVendor({ account_number: accountNumber, bank_code: bankCode });
      toast.success("Bank details saved!");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to save bank details");
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfile(true);
    try {
      await api.vendors.uploadImage(file, "profile");
      toast.success("Profile image updated!");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to upload image");
    } finally {
      setIsUploadingProfile(false);
      if (profileImageInputRef.current) profileImageInputRef.current.value = "";
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingGallery(true);
    try {
      for (const file of files) {
        await api.vendors.uploadImage(file, "gallery");
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} added!`);
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to upload photos");
    } finally {
      setIsUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleDeleteGalleryImage = async (url: string) => {
    try {
      await api.vendors.deleteGalleryImage(url);
      toast.success("Photo removed");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to remove photo");
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
              <img src="/Plagohive.svg" alt="Plagohive" className="h-12 w-auto object-contain" />
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
                  <div
                    className="relative w-16 h-16 flex-shrink-0 cursor-pointer group"
                    onClick={() => profileImageInputRef.current?.click()}
                    title="Change profile image"
                  >
                    {vendor.profile_image_url ? (
                      <img
                        src={vendor.profile_image_url}
                        alt={vendor.business_name}
                        className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 border border-border rounded-2xl flex items-center justify-center shadow-sm">
                        {(() => { const Icon = getCategoryIcon(vendor.category); return <Icon className="h-7 w-7 text-primary/60" />; })()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingProfile
                        ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                        : <Camera className="h-5 w-5 text-white" />
                      }
                    </div>
                    <input
                      ref={profileImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleProfileImageUpload}
                    />
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
                        <Banknote className="h-3.5 w-3.5" /> From ₦{Number(vendor.starting_price).toLocaleString()}
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
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Base Rate (₦)</label>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input name="starting_price" type="number" defaultValue={vendor.starting_price} placeholder="50000" className="pl-9 text-sm h-10" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">Charged on every booking. Add-on services are priced separately below.</p>
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

                {/* Service Photos Gallery */}
                <div className="bg-white border border-border rounded-2xl p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">Service Photos</h2>
                        <p className="text-xs text-muted-foreground">Showcase your work to attract customers</p>
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 pointer-events-none"
                        disabled={isUploadingGallery}
                        asChild
                      >
                        <span>
                          {isUploadingGallery
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Upload className="h-3.5 w-3.5" />
                          }
                          Add Photos
                        </span>
                      </Button>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleGalleryUpload}
                      />
                    </label>
                  </div>

                  {vendor.gallery_images && vendor.gallery_images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {vendor.gallery_images.map((url: string) => (
                        <div key={url} className="relative group aspect-square">
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                          <button
                            onClick={() => handleDeleteGalleryImage(url)}
                            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">No photos yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Click to upload and showcase your services</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleGalleryUpload}
                      />
                    </label>
                  )}
                </div>

                {/* Service Items */}
                <div id="services" className="bg-white border border-border rounded-2xl p-6 lg:col-span-2 scroll-mt-28">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Package className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">Service Items & Pricing</h2>
                        <p className="text-xs text-muted-foreground">Define what you offer and how you charge for it</p>
                      </div>
                    </div>
                    {!showAddItem && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAddItem(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add Item
                      </Button>
                    )}
                  </div>

                  {/* Add/Edit form */}
                  {showAddItem && (
                    <form onSubmit={handleItemSubmit} className="mb-5 p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                      <p className="text-sm font-semibold">{editingItem ? "Edit Item" : "New Service Item"}</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Item Name *</label>
                          <Input
                            placeholder="e.g. Mocktails"
                            value={itemForm.name}
                            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Label *</label>
                          <select
                            value={itemForm.unit_label}
                            onChange={(e) => setItemForm((f) => ({ ...f, unit_label: e.target.value }))}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {["each", "per head", "per plate", "per table", "per hour", "per day", "flat rate"].map((l) => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Price (₦) *</label>
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            placeholder="5000"
                            value={itemForm.unit_price}
                            onChange={(e) => setItemForm((f) => ({ ...f, unit_price: e.target.value }))}
                            className="h-9 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
                          <Input
                            placeholder="Brief description"
                            value={itemForm.description}
                            onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={cancelItemForm} className="text-xs">Cancel</Button>
                        <Button
                          type="submit"
                          size="sm"
                          className="text-xs"
                          disabled={createItemMutation.isPending || updateItemMutation.isPending}
                        >
                          {(createItemMutation.isPending || updateItemMutation.isPending)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : editingItem ? "Save Changes" : "Add Item"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Items list */}
                  {serviceItemsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : serviceItems.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-foreground mb-1">No service items yet</p>
                      <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">
                        Add your menu, packages, or individual services with pricing. Customers pick what they want when booking — you get paid based on their selection plus your base rate.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {["Rice ₦100k", "DJ Set ₦150k/hr", "Cocktails ₦3k/person", "Floral setup ₦50k"].map(ex => (
                          <span key={ex} className="text-[11px] bg-white border border-border px-2.5 py-1 rounded-full text-muted-foreground">{ex}</span>
                        ))}
                      </div>
                      <Button size="sm" onClick={() => setShowAddItem(true)} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Add your first service
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                      {(serviceItems as any[]).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                              {!item.is_active && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">hidden</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ₦{Number(item.unit_price).toLocaleString()} / {item.unit_label}
                              {item.description && ` · ${item.description}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title={item.is_active ? "Hide from customers" : "Show to customers"}
                              onClick={() => updateItemMutation.mutate({ id: item.id, data: { is_active: !item.is_active } })}
                            >
                              {item.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              disabled={deleteItemMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payout Settings */}
                <div id="payouts" className="bg-white border border-border rounded-2xl p-6 lg:col-span-2 scroll-mt-28">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Payout Settings</h2>
                      <p className="text-xs text-muted-foreground">Bank details for receiving payments</p>
                    </div>
                  </div>

                  {!vendor.bank_code && !vendor.account_number && (
                    <div className="mb-4 flex items-start gap-2.5 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-orange-700">Payouts not set up</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add your bank details so we can pay you when bookings complete. Without this, funds cannot be transferred to you.
                        </p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleBankSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Bank Name</label>
                        <select
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Select Bank</option>
                          <optgroup label="Commercial Banks">
                            <option value="044">Access Bank</option>
                            <option value="063">Access Bank (Diamond)</option>
                            <option value="035A">ALAT by Wema</option>
                            <option value="050">Ecobank Nigeria</option>
                            <option value="070">Fidelity Bank</option>
                            <option value="011">First Bank of Nigeria</option>
                            <option value="214">First City Monument Bank</option>
                            <option value="058">Guaranty Trust Bank</option>
                            <option value="030">Heritage Bank</option>
                            <option value="301">Jaiz Bank</option>
                            <option value="082">Keystone Bank</option>
                            <option value="076">Polaris Bank</option>
                            <option value="101">Providus Bank</option>
                            <option value="221">Stanbic IBTC Bank</option>
                            <option value="068">Standard Chartered Bank</option>
                            <option value="232">Sterling Bank</option>
                            <option value="100">SunTrust Bank</option>
                            <option value="032">Union Bank of Nigeria</option>
                            <option value="033">United Bank for Africa</option>
                            <option value="215">Unity Bank</option>
                            <option value="035">Wema Bank</option>
                            <option value="057">Zenith Bank</option>
                          </optgroup>
                          <optgroup label="Digital Banks &amp; Fintechs">
                            <option value="100004">Kuda Bank</option>
                            <option value="999992">OPay</option>
                            <option value="999991">PalmPay</option>
                            <option value="090110">VFD Microfinance Bank</option>
                            <option value="090267">Moniepoint MFB</option>
                            <option value="565">Carbon</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Account Number</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0123456789"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          maxLength={10}
                          className="h-10 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">{accountNumber.length}/10 digits</p>
                      </div>
                    </div>

                    {/* Account name preview */}
                    {isResolving && (
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        Verifying account with your bank…
                      </div>
                    )}
                    {resolvedName && !isResolving && (
                      <div className="flex items-center gap-2.5 bg-green-500/8 border border-green-500/25 rounded-xl px-4 py-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-green-700 font-semibold">{resolvedName}</p>
                          <p className="text-[11px] text-green-600/80 mt-0.5">Account confirmed — save to enable payouts</p>
                        </div>
                      </div>
                    )}
                    {accountNumber.length === 10 && bankCode && UNRESOLVABLE_BANKS.has(bankCode) && !isResolving && (
                      <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-primary font-semibold">Details look good</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">This bank doesn't support instant name verification — your details will be confirmed when processing your first payout.</p>
                        </div>
                      </div>
                    )}
                    {resolveError && !isResolving && (
                      <div className="flex items-start gap-2.5 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-orange-700 font-semibold">Couldn't auto-verify</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{resolveError} Double-check your details are correct — you can still save and we'll confirm at payout time.</p>
                        </div>
                      </div>
                    )}

                    <Button type="submit" variant="outline" className="h-10 font-semibold" disabled={isSavingBank || isResolving}>
                      {isSavingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Bank Details"}
                    </Button>
                  </form>
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
