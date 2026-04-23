import { Card } from "@/components/ui/card";
import { ShoppingBag, Users, Shield, TrendingUp, CheckCircle2 } from "lucide-react";

export const ValueProposition = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Plagohive</span>?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We're revolutionizing how events are planned across Africa
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* For Customers */}
          <Card className="p-8 border border-border hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1 bg-white group">
            <div className="mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-5">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-1.5 text-foreground">For Event Planners</h3>
              <p className="text-muted-foreground text-sm">Planning your dream event has never been easier</p>
            </div>
            <ul className="space-y-3">
              {[
                "Browse verified vendors across all categories",
                "Compare prices within your budget",
                "Read authentic reviews and ratings",
                "Book multiple vendors seamlessly",
                "Secure payment protection",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* For Vendors */}
          <Card className="p-8 border border-border hover:border-accent/40 hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1 bg-white group">
            <div className="mb-6">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-5">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-1.5 text-foreground">For Vendors</h3>
              <p className="text-muted-foreground text-sm">Grow your business and reach more customers</p>
            </div>
            <ul className="space-y-3">
              {[
                "Get discovered by thousands of event planners",
                "Build trust with verification badges",
                "Manage bookings in one place",
                "Receive payments securely",
                "Showcase your best work and reviews",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { icon: Shield, label: "Verified Vendors", iconClass: "text-primary", bgClass: "bg-primary/10" },
            { icon: Users, label: "Trusted Community", iconClass: "text-secondary-foreground", bgClass: "bg-secondary/20" },
            { icon: TrendingUp, label: "Growing Network", iconClass: "text-accent", bgClass: "bg-accent/10" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-border hover:border-primary/25 hover:shadow-[var(--shadow-elevated)] transition-all duration-200"
            >
              <div className={`w-10 h-10 ${item.bgClass} rounded-xl flex items-center justify-center`}>
                <item.icon className={`h-5 w-5 ${item.iconClass}`} />
              </div>
              <span className="text-xs font-semibold text-foreground text-center leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
