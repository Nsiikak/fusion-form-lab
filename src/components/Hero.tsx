import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen pt-20 flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary-glow to-accent">
      {/* Subtle depth layer */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16">
        <div className="max-w-4xl mx-auto text-center">

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
            Connect with{" "}
            <span className="inline-block bg-secondary text-primary px-4 py-1 rounded-xl">
              Trusted
            </span>{" "}
            Event Vendors
          </h1>

          <p className="text-lg sm:text-xl text-white/85 mb-12 max-w-2xl mx-auto leading-relaxed">
            Africa's premier marketplace for planning unforgettable events.
            Find verified vendors, compare prices, and book with confidence.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/vendor-search">
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-xl transition-all duration-200 hover:scale-105 text-base px-8 py-6 font-semibold"
              >
                <Search className="mr-2 h-5 w-5" />
                Find Vendors
              </Button>
            </Link>
            <Link to="/vendor-registration">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 hover:scale-105 text-base px-8 py-6 font-semibold group"
              >
                Become a Vendor
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { number: "1,000+", label: "Verified Vendors" },
              { number: "5,000+", label: "Events Planned" },
              { number: "4.8★", label: "Average Rating" },
              { number: "100%", label: "Secure Payments" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-colors duration-200"
              >
                <div className="text-2xl font-bold text-white mb-1">{stat.number}</div>
                <div className="text-xs text-white/75 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-white/60 rounded-full" />
        </div>
      </div>
    </section>
  );
};
