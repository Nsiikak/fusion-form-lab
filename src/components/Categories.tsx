import { Button } from "@/components/ui/button";
import { Utensils, Palette, Truck, Camera, Music, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const categories = [
  {
    icon: Utensils,
    name: "Catering",
    description: "Delicious meals for every taste",
    vendors: "200+ vendors",
    iconBg: "bg-[hsl(var(--primary-light))] text-primary",
  },
  {
    icon: Palette,
    name: "Decoration",
    description: "Beautiful setups and designs",
    vendors: "150+ vendors",
    iconBg: "bg-[hsl(var(--accent-light))] text-accent",
  },
  {
    icon: Truck,
    name: "Logistics",
    description: "Smooth event transportation",
    vendors: "100+ vendors",
    iconBg: "bg-[#E8F5E9] text-[#2E7D32]",
  },
  {
    icon: Camera,
    name: "Photography",
    description: "Capture every precious moment",
    vendors: "180+ vendors",
    iconBg: "bg-[hsl(var(--primary-light))] text-primary",
  },
  {
    icon: Music,
    name: "Entertainment",
    description: "DJs, bands, and performers",
    vendors: "120+ vendors",
    iconBg: "bg-[hsl(var(--accent-light))] text-accent",
  },
  {
    icon: Sparkles,
    name: "More Categories",
    description: "Explore all vendor types",
    vendors: "250+ vendors",
    iconBg: "bg-[#EDE7F6] text-[#5E35B1]",
  },
];

export const Categories = () => {
  return (
    <section id="categories" className="py-24 px-[5vw]">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center">
          <div className="section-label section-label-blue">Browse by category</div>
          <h2 className="section-title mx-auto">
            Explore <span className="text-gradient-brand">Categories</span>
          </h2>
          <p className="section-sub mx-auto">
            Find the perfect vendors for every aspect of your event.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {categories.map((c) => (
            <Link
              key={c.name}
              to="/vendor-search"
              className="group relative bg-white rounded-2xl border-[1.5px] border-border hover:border-primary hover:shadow-[0_8px_32px_hsl(210_79%_42%/0.12)] hover:-translate-y-0.5 transition-all p-7 overflow-hidden"
            >
              <div
                className={`w-12 h-12 ${c.iconBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}
              >
                <c.icon className="w-6 h-6" />
              </div>
              <div className="font-display text-base font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors">
                {c.name}
              </div>
              <p className="text-sm text-muted-foreground mb-5 leading-snug">
                {c.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary bg-[hsl(var(--primary-light))] px-2.5 py-1 rounded-full">
                  {c.vendors}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                style={{ background: "var(--gradient-brand)" }}
              />
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/vendor-search">
            <Button className="h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold px-8 py-3.5 rounded-xl text-[15px] shadow-[var(--shadow-primary)] group">
              Browse All Categories
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
