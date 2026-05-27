import { Shield, Star, CreditCard, Award } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Verified Vendors Only",
    description: "Every vendor goes through our rigorous verification process to ensure quality and reliability.",
    iconBg: "bg-[hsl(var(--primary-light))] text-primary",
  },
  {
    icon: Star,
    title: "Authentic Reviews",
    description: "Real feedback from real customers helps you make informed decisions with confidence.",
    iconBg: "bg-[hsl(var(--accent-light))] text-accent",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Your payments are protected with industry-standard security and fraud prevention.",
    iconBg: "bg-[#E8F5E9] text-[#2E7D32]",
  },
  {
    icon: Award,
    title: "Quality Guarantee",
    description: "We stand behind every booking with our satisfaction guarantee and support team.",
    iconBg: "bg-[#EDE7F6] text-[#5E35B1]",
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
    <section className="py-24 px-[5vw] bg-secondary">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--primary-light))] text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Shield className="h-4 w-4" />
            Built on Trust
          </div>
          <h2 className="section-title mx-auto">
            Your Peace of Mind is Our <span className="text-gradient-brand">Priority</span>
          </h2>
          <p className="section-sub mx-auto">
            We've built a platform where trust and quality come first.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-10 max-w-[1000px] mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border-[1.5px] border-border hover:border-primary hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all p-7"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${f.iconBg}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div
          className="rounded-3xl p-10 text-white shadow-[var(--shadow-lg)] max-w-[1000px] mx-auto"
          style={{ background: "var(--gradient-brand)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-3xl md:text-4xl font-extrabold mb-1 tabular-nums">
                  {stat.value}
                </div>
                <div className="text-white/80 text-xs font-semibold uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
