import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const CTA = () => {
  const { isAuthenticated } = useAuth();
  return (
    <section
      className="py-[100px] px-[5vw]"
      style={{
        background:
          "radial-gradient(ellipse 60% 80% at 50% 50%, hsl(210 79% 42% / 0.06) 0%, transparent 70%), hsl(220 14% 97%)",
      }}
    >
      <div className="max-w-[680px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-[hsl(var(--primary-light))] text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6">
          <Sparkles className="h-4 w-4" />
          Start Planning Today
        </div>

        <h2
          className="font-display font-extrabold text-foreground leading-[1.1] mb-5"
          style={{ fontSize: "clamp(28px, 3vw, 44px)", letterSpacing: "-0.04em" }}
        >
          Ready to Plan Your <span className="text-gradient-brand">Dream Event</span>?
        </h2>

        <p className="text-[17px] text-muted-foreground leading-[1.75] mb-10 font-normal max-w-xl mx-auto">
          Join thousands of satisfied customers who have planned unforgettable events with Plagohive. Get started in minutes.
        </p>

        <div className="flex gap-3.5 justify-center flex-wrap mb-9">
          <Link to="/vendor-search">
            <Button className="h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold px-8 py-4 rounded-xl text-base shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-lg)] transition-all hover:-translate-y-px group">
              Start Planning Now
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
          {!isAuthenticated && (
            <Link to="/vendor-registration">
              <Button
                variant="outline"
                className="h-auto bg-transparent border-[1.5px] border-primary text-primary hover:bg-[hsl(var(--primary-light))] font-semibold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-px"
              >
                Become a Vendor
              </Button>
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-muted-foreground text-sm">
          {["No credit card required", "Free to browse", "24/7 support"].map((perk) => (
            <div key={perk} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary/50 rounded-full" />
              <span>{perk}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
