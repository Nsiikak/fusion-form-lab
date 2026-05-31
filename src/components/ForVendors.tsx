import { Button } from "@/components/ui/button";
import { Lock, BarChart3, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const features = [
  {
    icon: Lock,
    iconBg: "bg-[hsl(var(--primary-light))] text-primary",
    title: "Verified Vendor Badge",
    desc: "Complete our Q&A verification and earn a trust badge that signals credibility to every customer browsing your profile.",
  },
  {
    icon: BarChart3,
    iconBg: "bg-[hsl(var(--accent-light))] text-accent",
    title: "Powerful Bookings Dashboard",
    desc: "Track all your bookings, pending requests, revenues, and reviews from one beautifully simple dashboard.",
  },
  {
    icon: CreditCard,
    iconBg: "bg-[#EDE7F6] text-[#5E35B1]",
    title: "Secure, Instant Payments",
    desc: "Funds are secured at booking and released on event completion. No more chasing payments or cash-only awkwardness.",
  },
];

const rows = [
  { initials: "AO", bg: "bg-primary",     name: "Amara Okafor",        event: "Wedding · Apr 19, 2026",     status: "Confirmed",   sClass: "bg-[#E8F5E9] text-[#2E7D32]" },
  { initials: "EI", bg: "bg-accent",      name: "Emeka Ibe",           event: "Birthday · Apr 22, 2026",    status: "Pending",     sClass: "bg-[hsl(var(--accent-light))] text-[hsl(var(--accent-deep))]" },
  { initials: "FA", bg: "bg-foreground",  name: "Fatima Abdullahi",    event: "Conference · Apr 26, 2026",  status: "New Request", sClass: "bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-deep))]" },
];

export const ForVendors = () => {
  const { isAuthenticated } = useAuth();
  return (
    <section id="vendors" className="py-24 px-[5vw]">
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-20 items-center">
        {/* Dashboard mockup — placed first so it appears on right via order-2 on desktop */}
        <div className="lg:order-2">
          <div className="bg-white rounded-3xl border border-border shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="bg-primary px-5 py-3.5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <span className="ml-2.5 font-display text-[13px] font-medium text-white/80">
                Vendor Dashboard — Chukwudi's Kitchen
              </span>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-secondary rounded-xl p-3.5 text-center">
                  <div className="font-display text-xl font-extrabold text-primary">₦324K</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">This Month</div>
                </div>
                <div className="bg-secondary rounded-xl p-3.5 text-center">
                  <div className="font-display text-xl font-extrabold text-foreground">18</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Bookings</div>
                </div>
                <div className="bg-secondary rounded-xl p-3.5 text-center">
                  <div className="font-display text-xl font-extrabold text-accent">4.9★</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Rating</div>
                </div>
              </div>

              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-3">
                Upcoming Bookings
              </div>

              {rows.map((row, i) => (
                <div
                  key={row.initials}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < rows.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div
                    className={`${row.bg} w-8 h-8 rounded-lg flex items-center justify-center font-display text-[13px] font-extrabold text-white flex-shrink-0`}
                  >
                    {row.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{row.name}</div>
                    <div className="text-[11px] text-muted-foreground">{row.event}</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${row.sClass}`}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="lg:order-1">
          <div className="section-label">For vendors</div>
          <h2 className="section-title">
            Grow your event<br />business with us
          </h2>
          <p className="section-sub">
            Thousands of customers are actively searching for vendors like you. Get found, get booked, and get paid — all through Plagohive.
          </p>

          <div className="mt-9 flex flex-col gap-6">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 items-start">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${f.iconBg}`}
                >
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-foreground mb-1">{f.title}</div>
                  <div className="text-[13.5px] text-muted-foreground leading-[1.65]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-3 flex-wrap">
            {!isAuthenticated && (
              <Link to="/vendor-registration">
                <Button className="h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold px-7 py-3.5 rounded-xl text-[15px] shadow-[var(--shadow-primary)]">
                  Register as Vendor
                </Button>
              </Link>
            )}
            <Link to="/vendor-search">
              <Button
                variant="outline"
                className="h-auto bg-transparent border-[1.5px] border-primary text-primary hover:bg-[hsl(var(--primary-light))] font-semibold px-7 py-3.5 rounded-xl text-[15px]"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
