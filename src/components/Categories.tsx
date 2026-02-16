import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Utensils, Palette, Truck, Camera, Music, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const Categories = () => {
  const categories = [
    {
      icon: Utensils,
      name: "Catering",
      description: "Delicious meals for every taste",
      color: "bg-primary/10 text-primary",
      vendors: "200+ vendors",
    },
    {
      icon: Palette,
      name: "Decoration",
      description: "Beautiful setups and designs",
      color: "bg-secondary/10 text-secondary",
      vendors: "150+ vendors",
    },
    {
      icon: Truck,
      name: "Logistics",
      description: "Smooth event transportation",
      color: "bg-accent/10 text-accent",
      vendors: "100+ vendors",
    },
    {
      icon: Camera,
      name: "Photography",
      description: "Capture every precious moment",
      color: "bg-primary/10 text-primary",
      vendors: "180+ vendors",
    },
    {
      icon: Music,
      name: "Entertainment",
      description: "DJs, bands, and performers",
      color: "bg-secondary/10 text-secondary",
      vendors: "120+ vendors",
    },
    {
      icon: Sparkles,
      name: "More Categories",
      description: "Explore all vendor types",
      color: "bg-accent/10 text-accent",
      vendors: "250+ vendors",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-background via-accent/5 to-background relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Categories</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find the perfect vendors for every aspect of your event
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
          {categories.map((category, index) => (
            <Link
              key={index}
              to="/vendor-search"
            >
              <Card
                className="group relative overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-[var(--shadow-3d)] cursor-pointer bg-white/60 backdrop-blur-sm"
              >
                <div className="p-6">
                  <div className={`w-14 h-14 ${category.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    <category.icon className="h-7 w-7" />
                  </div>

                  <h3 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>

                  <p className="text-muted-foreground text-sm mb-3">
                    {category.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary bg-primary/5 px-2 py-1 rounded-full">
                      {category.vendors}
                    </span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link to="/vendor-search">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 group text-white"
            >
              Browse All Categories
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
