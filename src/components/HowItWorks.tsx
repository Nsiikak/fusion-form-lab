import { Search, Filter, Calendar, CheckCircle } from "lucide-react";

export const HowItWorks = () => {
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

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-background to-primary/5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
            How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Plan your perfect event in four simple steps
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative group"
              >
                {/* Connector line (hidden on mobile, shown on lg+) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/20 to-transparent -z-10" />
                )}

                <div className="relative">
                  {/* Step number */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 bg-gradient-to-br from-primary to-primary-glow text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg z-20">
                    {index + 1}
                  </div>

                  {/* Card */}
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-[var(--shadow-3d)] transition-all duration-500 hover:-translate-y-2 border border-white/20 hover:border-primary/30 h-full">
                    {/* Icon */}
                    <div className={`w-16 h-16 bg-${step.color}/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className={`h-8 w-8 text-${step.color}`} />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
