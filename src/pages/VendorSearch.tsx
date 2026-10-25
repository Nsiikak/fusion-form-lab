import { useState, useEffect, type ElementType } from "react";
import ImageCarousel from "@/components/common/ImageCarousel";
import FavoriteButton, { ResponseBadge } from "@/components/common/FavoriteButton";
import { thumb } from "@/lib/images";
import { track } from "@/lib/analytics";
import { useSeo } from "@/lib/seo";
import { categoryLabel } from "@/lib/categories";
import { CATEGORIES } from "@/lib/categories";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Star, Filter, LogOut, Utensils, Palette, Camera, Music, Truck, Building2, Store, CheckCircle2, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Footer } from "@/components/Footer";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const categories = [
  "All Categories", "Catering", "Decoration", "Photography",
  "Entertainment", "Logistics", "Venue"
];

// Map frontend category names to backend enum values
const categoryMap: Record<string, string | null> = {
  "All Categories": null,
  ...Object.fromEntries(CATEGORIES.map((c) => [c.label, c.value])),
};

const VendorSearch = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id");
  const { category: routeCategory, city: routeCity } = useParams();
  const [availableOn, setAvailableOn] = useState(searchParams.get("date") || "");
  // Links from the home search, occasion guides and event checklists pass ?category= and ?search=
  useEffect(() => {
    const cat = searchParams.get("category") || routeCategory;
    const q = searchParams.get("search");
    if (cat) setSelectedCategory(getCategoryDisplayName(cat));
    if (q) { setSearchQuery(q); setSearchInput(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [budget, setBudget] = useState([300000]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const cityName = routeCity ? routeCity.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  const catName = routeCategory ? categoryLabel(routeCategory) : "";
  useSeo(routeCategory || routeCity ? {
    title: `${catName || "Event vendors"}${cityName ? ` in ${cityName}` : ""}`,
    description: `Book verified ${(catName || "event vendors").toLowerCase()}${cityName ? ` in ${cityName}` : ""} on Plagohive. Real prices in naira, and your payment is held until your event is done.`,
  } : {
    title: "Find event vendors",
    description: "Browse verified caterers, decorators, DJs, photographers and more. Your payment is held until your event is done.",
  });

  // Fetch vendors from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vendors", selectedCategory, budget, searchQuery, page, availableOn],
    queryFn: async () => {
      const params: any = {
        page,
        limit: 20,
      };

      const categoryValue = categoryMap[selectedCategory];
      if (categoryValue) {
        params.category = categoryValue;
      }

      if (budget[0] < 500000) {
        params.max_price = budget[0];
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (availableOn) params.available_on = availableOn;
      if (routeCity) params.location = routeCity.replace(/-/g, " ");
      if (searchQuery.trim() || categoryValue) track("search", { category: categoryValue || "all", has_query: !!searchQuery.trim(), date: !!availableOn });

      const response = await api.vendors.list(params);
      return response;
    },
  });

  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
  }, [selectedCategory, budget, searchQuery]);

  const vendors = data?.vendors || [];
  const totalVendors = data?.total || 0;

  // Handle search input with debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  if (error) {
    toast.error("Failed to load vendors. Please try again.");
  }

  // Map category enum to display name
  const getCategoryDisplayName = (category: string) => {
    const entry = Object.entries(categoryMap).find(([_, value]) => value === category);
    return entry ? entry[0] : category;
  };

  const categoryIconMap: Record<string, React.ElementType> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.icon]));

  const getCategoryIcon = (category: string): React.ElementType => {
    return categoryIconMap[category] || Store;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src="/Plagohive.svg" alt="Plagohive" className="w-auto object-contain h-7 sm:h-8" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Find Vendors</Link>
              {!isAuthenticated && (
                <Link to="/vendor-registration" className="text-sm font-medium hover:text-primary transition-colors">Become a Vendor</Link>
              )}
              {isAuthenticated ? (
                <>
                  {user?.role === "customer" && (
                    <Link to="/customer-dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
                  )}
                  {user?.role === "vendor" && (
                    <Link to="/vendor-dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
                  )}
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button>Sign In</Button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Search Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-glow to-accent py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center mb-8">
            Find Your Perfect Event Vendors
          </h1>

          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search vendors or services..."
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button size="lg" className="px-8" onClick={() => refetch()}>
                <Filter className="mr-2 h-5 w-5" />
                Filter
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block" htmlFor="avail-date">Event date (optional): only show vendors who are free</label>
                <input id="avail-date" type="date" value={availableOn} min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => { setAvailableOn(e.target.value); setPage(1); }}
                  className="h-10 w-full sm:w-auto rounded-md border border-input bg-white px-3 text-sm mb-4" />
                <label className="text-sm font-medium mb-2 block">Show vendors starting under ₦{budget[0].toLocaleString()}</label>
                <Slider
                  value={budget}
                  onValueChange={setBudget}
                  max={500000}
                  min={10000}
                  step={10000}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 border-b bg-white sticky top-[73px] z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              {isLoading ? "Loading..." : `${totalVendors} Vendor${totalVendors !== 1 ? 's' : ''} Found`}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-9 w-28 rounded-md" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                <SearchX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No vendors found</h3>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Try broadening your search — remove a category filter, increase your budget, or clear the search text.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setSelectedCategory("All Categories"); setBudget([300000]); setSearchInput(""); }}
                >
                  Clear all filters
                </Button>
                <Link to="/vendor-registration">
                  <Button variant="ghost" className="text-primary hover:text-primary">
                    Can't find what you need? Join as a vendor →
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map((vendor: any) => (
                  <Card
                    key={vendor.id}
                    className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                      {vendor.gallery_images?.length ? (
                        <ImageCarousel images={vendor.gallery_images.slice(0, 6).map((u: string) => thumb(u))} alt={vendor.business_name} className="w-full h-full">
                          <FavoriteButton vendorId={vendor.id} className="absolute top-2.5 right-2.5" />
                        </ImageCarousel>
                      ) : vendor.profile_image_url ? (
                        <img src={vendor.profile_image_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                      ) : (
                        (() => { const Icon = getCategoryIcon(vendor.category); return <Icon className="h-12 w-12 text-primary/40" />; })()
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-lg mb-1">{vendor.business_name}</h3>
                          <Badge variant="secondary">{getCategoryDisplayName(vendor.category)}</Badge>
                        </div>
                        {vendor.verification_status === "approved" && (
                          <Badge className="bg-celebrate-emerald hover:bg-celebrate-emerald text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                        )}
                      </div>

                      {vendor.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {vendor.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{vendor.location}</span>
                        <ResponseBadge hours={vendor.response_hours} />
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">Base rate from</p>
                          <p className="text-xl font-bold text-primary">
                            ₦{Number(vendor.starting_price).toLocaleString()}
                          </p>
                        </div>
                        <Link to={`/vendors/${vendor.id}${eventId ? `?event_id=${eventId}` : ""}`}>
                          <Button>View Details</Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {data && data.total_pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                    disabled={page === data.total_pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>


    </div>
  );
};

export default VendorSearch;
