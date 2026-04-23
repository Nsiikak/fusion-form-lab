import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export const CTA = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Gradient background — same as Hero for consistency */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-glow to-accent" />
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/20">
            <Sparkles className="h-4 w-4" />
            Start Planning Today
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 leading-tight tracking-tight">
            Ready to Plan Your Dream Event?
          </h2>

          <p className="text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Join thousands of satisfied customers who have planned unforgettable events with Plagohive.
            Get started in minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
            <Link to="/vendor-search">
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-xl transition-all duration-200 hover:scale-105 font-semibold px-8 group"
              >
                Start Planning Now
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Button>
            </Link>
            <Link to="/vendor-search">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent text-white border border-white/40 hover:bg-white/10 backdrop-blur-sm transition-all duration-200 hover:scale-105 font-semibold px-8"
              >
                Learn More
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-white/65 text-sm">
            {["No credit card required", "Free to browse", "24/7 support"].map((perk) => (
              <div key={perk} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
