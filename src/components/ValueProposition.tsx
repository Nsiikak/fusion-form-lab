import { Card } from "@/components/ui/card";
import { ShoppingBag, Users, Shield, TrendingUp } from "lucide-react";

export const ValueProposition = () => {
  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Why Choose <span className="text-primary">Plagohive</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're revolutionizing how events are planned across Africa
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* For Customers */}
          <Card className="p-8 hover:shadow-[var(--shadow-3d)] transition-all duration-500 hover:-translate-y-2 border-2 hover:border-primary/50 bg-gradient-to-br from-white to-muted/50">
            <div className="mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">For Event Planners</h3>
              <p className="text-muted-foreground">
                Planning your dream event has never been easier
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Browse verified vendors across all categories",
                "Compare prices within your budget",
                "Read authentic reviews and ratings",
                "Book multiple vendors seamlessly",
                "Secure payment protection",
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* For Vendors */}
          <Card className="p-8 hover:shadow-[var(--shadow-3d)] transition-all duration-500 hover:-translate-y-2 border-2 hover:border-accent/50 bg-gradient-to-br from-white to-accent/5">
            <div className="mb-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">For Vendors</h3>
              <p className="text-muted-foreground">
                Grow your business and reach more customers
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Get discovered by thousands of event planners",
                "Build trust with verification badges",
                "Manage bookings in one place",
                "Receive payments securely",
                "Showcase your best work and reviews",
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Trust indicators */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Shield, label: "Verified Vendors", color: "primary" },
            { icon: Users, label: "Trusted Community", color: "secondary" },
            { icon: TrendingUp, label: "Growing Network", color: "accent" },
          ].map((item, index) => (
            <div 
              key={index}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:scale-105"
            >
              <div className={`w-12 h-12 bg-${item.color}/10 rounded-full flex items-center justify-center`}>
                <item.icon className={`h-6 w-6 text-${item.color}`} />
              </div>
              <span className="font-semibold text-foreground text-center">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
