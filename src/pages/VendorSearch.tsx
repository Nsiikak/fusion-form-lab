import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, Star, Filter } from "lucide-react";
import { Footer } from "@/components/Footer";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";

const categories = [
  "All Categories", "Catering", "Decoration", "Photography", 
  "Entertainment", "Logistics", "Venue"
];

const vendors = [
  { 
    id: 1, 
    name: "Premium Catering Co.", 
    category: "Catering", 
    rating: 4.8, 
    reviews: 124, 
    price: 150000, 
    location: "Lagos",
    verified: true,
    image: "🍽️"
  },
  { 
    id: 2, 
    name: "Elegant Decor", 
    category: "Decoration", 
    rating: 4.9, 
    reviews: 89, 
    price: 80000, 
    location: "Abuja",
    verified: true,
    image: "🎨"
  },
  { 
    id: 3, 
    name: "Snapshot Studios", 
    category: "Photography", 
    rating: 4.7, 
    reviews: 156, 
    price: 120000, 
    location: "Lagos",
    verified: true,
    image: "📸"
  },
  { 
    id: 4, 
    name: "Party Vibes DJ", 
    category: "Entertainment", 
    rating: 4.6, 
    reviews: 92, 
    price: 100000, 
    location: "Port Harcourt",
    verified: false,
    image: "🎵"
  },
  { 
    id: 5, 
    name: "Swift Logistics", 
    category: "Logistics", 
    rating: 4.8, 
    reviews: 67, 
    price: 60000, 
    location: "Lagos",
    verified: true,
    image: "🚚"
  },
  { 
    id: 6, 
    name: "Grand Halls", 
    category: "Venue", 
    rating: 4.9, 
    reviews: 201, 
    price: 250000, 
    location: "Abuja",
    verified: true,
    image: "🏛️"
  },
];

const VendorSearch = () => {
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [budget, setBudget] = useState([300000]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVendors = vendors.filter(vendor => {
    const matchesCategory = selectedCategory === "All Categories" || vendor.category === selectedCategory;
    const matchesBudget = vendor.price <= budget[0];
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesBudget && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-10" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/vendor-search" className="text-sm font-medium hover:text-primary transition-colors">Find Vendors</Link>
              <Link to="/vendor-registration" className="text-sm font-medium hover:text-primary transition-colors">Become a Vendor</Link>
              <Link to="/customer-dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
              <Button>Sign In</Button>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button size="lg" className="px-8">
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
              {filteredVendors.length} Vendors Found
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <Card 
                key={vendor.id}
                className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-6xl">
                  {vendor.image}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg mb-1">{vendor.name}</h3>
                      <Badge variant="secondary">{vendor.category}</Badge>
                    </div>
                    {vendor.verified && (
                      <Badge className="bg-accent">✓ Verified</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 mb-3">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{vendor.rating}</span>
                    <span className="text-sm text-muted-foreground">({vendor.reviews} reviews)</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4" />
                    {vendor.location}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Starting from</p>
                      <p className="text-xl font-bold text-primary">₦{vendor.price.toLocaleString()}</p>
                    </div>
                    <Button>View Details</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VendorSearch;
