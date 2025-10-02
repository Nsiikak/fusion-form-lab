import { Card } from "@/components/ui/card";
import { Shield, Star, CreditCard, Award } from "lucide-react";

export const TrustSection = () => {
  const features = [
    {
      icon: Shield,
      title: "Verified Vendors Only",
      description: "Every vendor goes through our rigorous verification process to ensure quality and reliability.",
      gradient: "from-primary/10 to-primary/5",
    },
    {
      icon: Star,
      title: "Authentic Reviews",
      description: "Real feedback from real customers helps you make informed decisions with confidence.",
      gradient: "from-secondary/10 to-secondary/5",
    },
    {
      icon: CreditCard,
      title: "Secure Payments",
      description: "Your payments are protected with industry-standard security and fraud prevention.",
      gradient: "from-accent/10 to-accent/5",
    },
    {
      icon: Award,
      title: "Quality Guarantee",
      description: "We stand behind every booking with our satisfaction guarantee and support team.",
      gradient: "from-primary/10 to-primary/5",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              Built on Trust
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Your Peace of Mind is Our <span className="text-primary">Priority</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We've built a platform where trust and quality come first
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-500 hover:shadow-[var(--shadow-elevated)] group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Stats bar */}
          <div className="mt-16 bg-gradient-to-r from-primary via-primary-glow to-accent rounded-3xl p-8 md:p-12 text-white shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold mb-2">98%</div>
                <div className="text-white/80 text-sm">Satisfaction Rate</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold mb-2">24/7</div>
                <div className="text-white/80 text-sm">Customer Support</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold mb-2">50K+</div>
                <div className="text-white/80 text-sm">Happy Customers</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold mb-2">100%</div>
                <div className="text-white/80 text-sm">Money-back Guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
