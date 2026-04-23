import { Search, Filter, Calendar, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Search & Discover",
    description: "Browse thousands of verified vendors across all event categories",
    color: "primary",
  },
  {
    icon: Filter,
    title: "Filter by Budget",
    description: "Find vendors that match your budget and requirements perfectly",
    color: "secondary",
  },
  {
    icon: Calendar,
    title: "Book with Confidence",
    description: "Secure your vendors with easy booking and payment protection",
    color: "accent",
  },
  {
    icon: CheckCircle,
    title: "Enjoy Your Event",
    description: "Relax knowing you've booked verified, reliable vendors",
    color: "primary",
  },
];

const colorMap: Record<string, { bg: string; icon: string }> = {
  primary:   { bg: "bg-primary/10",   icon: "text-primary" },
  secondary: { bg: "bg-secondary/20", icon: "text-secondary-foreground" },
  accent:    { bg: "bg-accent/10",    icon: "text-accent" },
};

export const HowItWorks = () => {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Plan your perfect event in four simple steps
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[calc(100%-8px)] w-full h-px bg-gradient-to-r from-border to-transparent z-0 pointer-events-none" />
                )}

                <div className="relative bg-white rounded-2xl p-6 border border-border hover:border-primary/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200 hover:-translate-y-1 h-full">
                  {/* Step number */}
                  <div className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-primary to-primary-glow text-white rounded-full flex items-center justify-center font-bold text-xs shadow-md z-10">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 ${colorMap[step.color].bg} rounded-xl flex items-center justify-center mb-5`}>
                    <step.icon className={`h-6 w-6 ${colorMap[step.color].icon}`} />
                  </div>

                  <h3 className="text-base font-bold mb-2 text-foreground group-hover:text-primary transition-colors duration-200">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
