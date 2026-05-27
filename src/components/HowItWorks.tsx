import { Search, Filter, Calendar, CheckCircle } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Search,
    title: "Search & Discover",
    desc: "Browse thousands of verified vendors across all event categories.",
    bg: "bg-primary",
  },
  {
    num: "02",
    icon: Filter,
    title: "Filter by Budget",
    desc: "Find vendors that match your budget and requirements perfectly.",
    bg: "bg-accent",
  },
  {
    num: "03",
    icon: Calendar,
    title: "Book with Confidence",
    desc: "Secure your vendors with easy booking and payment protection.",
    bg: "bg-[hsl(var(--primary-deep))]",
  },
  {
    num: "04",
    icon: CheckCircle,
    title: "Enjoy Your Event",
    desc: "Relax knowing you've booked verified, reliable vendors.",
    bg: "bg-gradient-brand",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-[5vw] bg-secondary">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <div className="section-label">How it works</div>
          <h2 className="section-title mx-auto">
            Plan your perfect event in four simple steps
          </h2>
          <p className="section-sub mx-auto">
            From browsing to booking in minutes. Plagohive is built to make event planning feel effortless.
          </p>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Connecting gradient line (desktop) */}
          <div
            className="hidden lg:block absolute top-8 left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] h-0.5 rounded pointer-events-none"
            style={{ background: "var(--gradient-brand)", opacity: 0.25 }}
          />

          {steps.map((step) => (
            <div
              key={step.num}
              className="relative bg-white rounded-2xl border border-border hover:border-primary/30 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all p-7"
            >
              <div
                className={`${step.bg} w-16 h-16 rounded-[18px] flex items-center justify-center mb-5 relative z-10`}
              >
                <step.icon className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div className="font-display text-xs font-bold text-muted-foreground mb-1.5 tracking-wider">
                STEP {step.num}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2.5">{step.title}</h3>
              <p className="text-sm leading-[1.7] text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
