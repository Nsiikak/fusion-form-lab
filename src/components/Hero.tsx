import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import logo from "@/assets/plagohive-logo.jpeg";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary-glow to-accent bg-[length:200%_200%] animate-gradient-shift">
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8 animate-scale-in">
            <img 
              src={logo} 
              alt="Plagohive" 
              className="h-16 sm:h-20 mx-auto drop-shadow-2xl"
            />
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 animate-slide-up leading-tight">
            Connect with{" "}
            <span className="inline-block bg-secondary text-primary px-4 py-1 rounded-xl transform rotate-1">
              Trusted
            </span>{" "}
            Event Vendors
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto animate-slide-up [animation-delay:200ms]">
            Africa's premier marketplace for planning unforgettable events. 
            Find verified vendors, compare prices, and book with confidence.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-slide-up [animation-delay:400ms]">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 shadow-2xl hover:shadow-white/50 transition-all duration-300 hover:scale-105 text-lg px-8 py-6 group"
            >
              Find Vendors
              <Search className="ml-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm shadow-xl transition-all duration-300 hover:scale-105 text-lg px-8 py-6 group"
            >
              Become a Vendor
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-slide-up [animation-delay:600ms]">
            {[
              { number: "1000+", label: "Verified Vendors" },
              { number: "5000+", label: "Events Planned" },
              { number: "4.8★", label: "Average Rating" },
              { number: "100%", label: "Secure Payments" },
            ].map((stat, index) => (
              <div 
                key={index} 
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-white rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
};
