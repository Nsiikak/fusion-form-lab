import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const CTA = () => {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-glow to-accent bg-[length:200%_200%] animate-gradient-shift" />
      
      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-secondary/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-white/20 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6 animate-scale-in">
            <Sparkles className="h-4 w-4" />
            Start Planning Today
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-slide-up">
            Ready to Plan Your Dream Event?
          </h2>

          <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto animate-slide-up [animation-delay:200ms]">
            Join thousands of satisfied customers who have planned unforgettable events with Plagohive. 
            Get started in minutes and discover why we're Africa's trusted event marketplace.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up [animation-delay:400ms]">
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 shadow-2xl hover:shadow-white/50 transition-all duration-300 hover:scale-105 text-lg px-10 py-7 group"
            >
              Start Planning Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-2 border-white/50 hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-105 text-lg px-10 py-7"
            >
              Learn More
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white/80 text-sm animate-slide-up [animation-delay:600ms]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>Free to browse</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>24/7 support</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
