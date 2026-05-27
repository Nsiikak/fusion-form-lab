import { Button } from "@/components/ui/button";
import { Search, Star, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Search,
    iconBg: "bg-[hsl(var(--primary-light))] text-primary",
    title: "Smart Budget Filters",
    desc: "Set your budget and instantly see only vendors that fit. No surprises, no awkward price conversations.",
  },
  {
    icon: Star,
    iconBg: "bg-[hsl(var(--accent-light))] text-accent",
    title: "Verified Ratings & Reviews",
    desc: "Every review is from a real, confirmed booking. Browse with confidence knowing ratings are earned, not bought.",
  },
  {
    icon: ClipboardList,
    iconBg: "bg-[#E8F5E9] text-[#2E7D32]",
    title: "Multi-Vendor Event Planning",
    desc: "Add caterers, decorators, photographers to a single event plan. Manage everything in one place, not ten chats.",
  },
];

const mockResults = [
  {
    emoji: "🌸",
    gradient: "linear-gradient(135deg, #E8F5E9, #C8E6C9)",
    name: "Bloom Interiors",
    rating: "★★★★★ 4.9 · 92 reviews",
    price: "₦95,000",
    status: "✓ Available",
    statusColor: "text-[#2E7D32]",
  },
  {
    emoji: "✨",
    gradient: "linear-gradient(135deg, #FFF3E0, #FFE0B2)",
    name: "Glam Events Co.",
    rating: "★★★★★ 4.8 · 78 reviews",
    price: "₦120,000",
    status: "✓ Available",
    statusColor: "text-[#2E7D32]",
  },
  {
    emoji: "🎪",
    gradient: "linear-gradient(135deg, hsl(214 100% 94%), #C5DCFF)",
    name: "StyleHaus Lagos",
    rating: "★★★★☆ 4.6 · 54 reviews",
    price: "₦75,000",
    status: "2 slots left",
    statusColor: "text-accent",
  },
];

export const ForCustomers = () => {
  return (
    <section className="py-24 px-[5vw] bg-secondary">
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-20 items-center">
        {/* Copy side */}
        <div>
          <div className="section-label">For customers</div>
          <h2 className="section-title">
            Plan smarter,<br />spend better
          </h2>
          <p className="section-sub">
            Find vendors you can trust, within a budget that works for you. No more endless WhatsApp searches or unreliable referrals.
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

          <div className="mt-8">
            <Link to="/register">
              <Button className="h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold px-7 py-3.5 rounded-xl text-[15px] shadow-[var(--shadow-primary)]">
                Start Planning Free
              </Button>
            </Link>
          </div>
        </div>

        {/* Mockup side */}
        <div className="relative bg-white rounded-3xl border border-border shadow-[var(--shadow-lg)] p-7 overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: "var(--gradient-brand)" }}
          />
          <div className="font-display text-sm font-bold text-foreground mb-5">
            🔍 Search Results — Decorators
          </div>

          <div className="flex gap-2 mb-5 flex-wrap">
            <span className="bg-primary text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
              Budget: ₦50k–₦150k
            </span>
            <span className="bg-[hsl(var(--primary-light))] text-primary text-[11px] font-semibold px-3 py-1.5 rounded-full">
              Lagos
            </span>
            <span className="bg-[hsl(var(--primary-light))] text-primary text-[11px] font-semibold px-3 py-1.5 rounded-full">
              Top Rated ★4.5+
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {mockResults.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-3.5 bg-secondary rounded-xl p-3.5"
              >
                <div
                  className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[22px] flex-shrink-0"
                  style={{ background: r.gradient }}
                >
                  {r.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-foreground truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.rating}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-sm font-extrabold text-primary">{r.price}</div>
                  <div className={`text-[11px] font-semibold ${r.statusColor}`}>{r.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
