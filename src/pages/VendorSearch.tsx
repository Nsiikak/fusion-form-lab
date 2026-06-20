import { useState, useEffect, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Star, Filter, LogOut, Loader2, Utensils, Palette, Camera, Music, Truck, Building2, Store, CheckCircle2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  "Catering": "catering",
  "Decoration": "decoration",
  "Photography": "photography",
  "Entertainment": "entertainment",
  "Logistics": "logistics",
  "Venue": "venue",
};

const VendorSearch = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [budget, setBudget] = useState([300000]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Fetch vendors from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vendors", selectedCategory, budget, searchQuery, page],
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

  const categoryIconMap: Record<string, React.ElementType> = {
    catering: Utensils,
    decoration: Palette,
    photography: Camera,
    entertainment: Music,
    logistics: Truck,
    venue: Building2,
  };

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
              <img src="/Plagohive.svg" alt="Plagohive" className="h-12 w-auto object-contain" />
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
                <label className="text-sm font-medium mb-2 block">Budget: ₦{budget[0].toLocaleString()}</label>
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
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No vendors found. Try adjusting your filters.</p>
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
                      {vendor.gallery_images?.[0] ? (
                        <img
                          src={vendor.gallery_images[0]}
                          alt={vendor.business_name}
                          className="w-full h-full object-cover"
                        />
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
                          <Badge className="bg-accent text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                        )}
                      </div>

                      {vendor.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {vendor.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <MapPin className="h-4 w-4" />
                        {vendor.location}
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
