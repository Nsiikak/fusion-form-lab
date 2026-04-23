import { Shield, Star, CreditCard, Award } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Verified Vendors Only",
    description: "Every vendor goes through our rigorous verification process to ensure quality and reliability.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Star,
    title: "Authentic Reviews",
    description: "Real feedback from real customers helps you make informed decisions with confidence.",
    iconBg: "bg-secondary/20",
    iconColor: "text-secondary-foreground",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Your payments are protected with industry-standard security and fraud prevention.",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  {
    icon: Award,
    title: "Quality Guarantee",
    description: "We stand behind every booking with our satisfaction guarantee and support team.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
];

const stats = [
  { value: "98%",  label: "Satisfaction Rate" },
  { value: "24/7", label: "Customer Support" },
  { value: "50K+", label: "Happy Customers" },
  { value: "100%", label: "Money-back Guarantee" },
];

export const TrustSection = () => {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              Built on Trust
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
              Your Peace of Mind is Our <span className="text-primary">Priority</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We've built a platform where trust and quality come first
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-10">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl border border-border hover:border-primary/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200 p-7 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                    <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold mb-2 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="bg-gradient-to-r from-primary via-primary-glow to-accent rounded-2xl p-8 md:p-10 text-white shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl md:text-4xl font-bold mb-1 tabular-nums">{stat.value}</div>
                  <div className="text-white/75 text-xs font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
