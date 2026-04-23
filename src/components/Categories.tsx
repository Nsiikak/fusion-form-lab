import { Button } from "@/components/ui/button";
import { Utensils, Palette, Truck, Camera, Music, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const categories = [
  { icon: Utensils, name: "Catering",        description: "Delicious meals for every taste",    colorClass: "bg-primary/10 text-primary",             vendors: "200+ vendors" },
  { icon: Palette,  name: "Decoration",      description: "Beautiful setups and designs",        colorClass: "bg-secondary/20 text-secondary-foreground", vendors: "150+ vendors" },
  { icon: Truck,    name: "Logistics",       description: "Smooth event transportation",         colorClass: "bg-accent/10 text-accent",               vendors: "100+ vendors" },
  { icon: Camera,   name: "Photography",     description: "Capture every precious moment",       colorClass: "bg-primary/10 text-primary",             vendors: "180+ vendors" },
  { icon: Music,    name: "Entertainment",   description: "DJs, bands, and performers",          colorClass: "bg-secondary/20 text-secondary-foreground", vendors: "120+ vendors" },
  { icon: Sparkles, name: "More Categories", description: "Explore all vendor types",            colorClass: "bg-accent/10 text-accent",               vendors: "250+ vendors" },
];

export const Categories = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Categories</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Find the perfect vendors for every aspect of your event
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto mb-10">
          {categories.map((category) => (
            <Link key={category.name} to="/vendor-search">
              <div className="group relative overflow-hidden border border-border hover:border-primary/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200 hover:-translate-y-1 cursor-pointer bg-white rounded-2xl h-full">
                <div className="p-6">
                  <div className={`w-12 h-12 ${category.colorClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200`}>
                    <category.icon className="h-6 w-6" />
                  </div>

                  <h3 className="text-base font-bold mb-1.5 text-foreground group-hover:text-primary transition-colors duration-200">
                    {category.name}
                  </h3>

                  <p className="text-muted-foreground text-sm mb-4 leading-snug">
                    {category.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-full">
                      {category.vendors}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link to="/vendor-search">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white transition-all duration-200 hover:scale-105 font-semibold group"
            >
              Browse All Categories
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
