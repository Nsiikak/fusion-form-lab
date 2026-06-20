import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, PartyPopper } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const categoryMap: Record<string, string> = {
  "All Categories": "",
  Catering: "catering",
  Decoration: "decoration",
  Photography: "photography",
  Logistics: "logistics",
  Entertainment: "entertainment",
};

export const Hero = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (category) params.set("category", category);
    navigate(`/vendor-search${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden pt-[150px] pb-20 px-[5vw]"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Geometric accent */}
      <div
        className="absolute top-0 right-0 w-[55%] h-full pointer-events-none"
        style={{
          background: "linear-gradient(135deg, transparent 40%, hsl(210 79% 42% / 0.03) 100%)",
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: Copy */}
        <div>
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--accent-light))] border border-accent/25 text-[hsl(var(--accent-deep))] text-[11.5px] font-bold uppercase tracking-[0.06em] px-3.5 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            Africa's Premier Event Marketplace
          </div>

          {/* Headline */}
          <h1
            className="font-display font-extrabold text-foreground leading-[1.07] mb-5"
            style={{ fontSize: "clamp(38px, 4.5vw, 62px)", letterSpacing: "-0.03em" }}
          >
            Connect with <span className="text-primary">Trusted</span><br />
            <span className="text-accent">Event Vendors</span>
          </h1>

          <p className="text-[17px] leading-[1.75] text-muted-foreground max-w-[460px] mb-9">
            Find verified caterers, photographers, DJs and more. Compare prices, read real reviews, and book with confidence — all in one place.
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-white border-[1.5px] border-primary/20 rounded-[18px] pl-4 pr-1.5 py-1.5 shadow-[var(--shadow-md)] mb-7 max-w-[520px] gap-2"
          >
            <Search className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search caterers, decorators, DJs…"
              aria-label="Search vendors"
              className="flex-1 border-none outline-none text-sm text-foreground placeholder:text-muted-foreground bg-transparent min-w-0"
            />
            <div className="w-px h-6 bg-primary/20 flex-shrink-0" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-none outline-none text-[13px] text-foreground/70 bg-transparent px-2 py-1 whitespace-nowrap cursor-pointer"
              aria-label="Category"
            >
              {Object.entries(categoryMap).map(([label, val]) => (
                <option key={label} value={val}>{label}</option>
              ))}
            </select>
            <Button type="submit" className="h-auto bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              Search
            </Button>
          </form>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-11">
            <Link to="/vendor-search">
              <Button className="h-auto bg-primary hover:bg-primary/90 text-white font-semibold px-7 py-3.5 rounded-xl text-[15px] shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-lg)] transition-all hover:-translate-y-px">
                <Search className="mr-2 h-4 w-4" />
                Find Vendors
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link to="/vendor-registration">
                <Button
                  variant="outline"
                  className="h-auto bg-transparent border-[1.5px] border-primary text-primary hover:bg-[hsl(var(--primary-light))] font-semibold px-7 py-3.5 rounded-xl text-[15px] transition-all hover:-translate-y-px"
                >
                  Become a Vendor
                </Button>
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-7 border-t border-border">
            {[
              { num: "1,000+", label: "Verified Vendors" },
              { num: "5,000+", label: "Events Planned" },
              { num: "4.8★", label: "Average Rating" },
              { num: "100%", label: "Secure Payments" },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-2xl font-bold text-foreground">{s.num}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Vendor card + chips — desktop only */}
        <div className="relative hidden lg:block">
          {/* Top floating chip */}
          <div className="absolute -top-5 -right-2.5 z-10 bg-white border border-primary/20 rounded-[18px] px-4 py-3 shadow-[var(--shadow-md)] flex items-center gap-3 animate-float">
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
              <PartyPopper className="w-[18px] h-[18px] text-[#2E7D32]" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">New Booking!</div>
              <div className="text-[11px] text-muted-foreground">Catering booked for next weekend</div>
            </div>
          </div>

          {/* Vendor card */}
          <div className="relative bg-white rounded-3xl border border-border shadow-[var(--shadow-lg)] p-6 overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: "var(--gradient-brand)" }}
            />
            <div className="flex items-center gap-3.5 mb-4">
              <div
                className="w-[52px] h-[52px] rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(214 100% 94%) 0%, #c5deff 100%)" }}
              >
                🍽️
              </div>
              <div>
                <div className="font-display text-[15.5px] font-bold text-foreground">Premium Catering Co.</div>
                <div className="text-xs text-muted-foreground mt-0.5">Premium Catering · Lagos</div>
              </div>
              <div className="ml-auto bg-[#E8F5E9] text-[#1B5E20] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} /> Verified
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-3.5">
              <span className="text-[hsl(var(--accent-mid))] text-[13px]">★★★★★</span>
              <span className="text-sm font-bold text-foreground">4.9</span>
              <span className="text-xs text-muted-foreground">(148 reviews)</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {["Weddings", "Corporate", "Birthdays", "Buffet"].map((tag) => (
                <span key={tag} className="bg-[hsl(var(--primary-light))] text-primary text-xs font-semibold px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[22px] font-extrabold text-foreground">
                  ₦85,000<span className="text-[13px] font-normal text-muted-foreground"> / event</span>
                </div>
              </div>
              <Link to="/vendor-search">
                <button className="bg-accent hover:bg-[hsl(var(--accent-mid))] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                  Book Now
                </button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Availability this month</span>
                <span>72%</span>
              </div>
              <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: "72%", background: "var(--gradient-brand)" }} />
              </div>
            </div>
          </div>

          {/* Bottom floating chip */}
          <div className="absolute -bottom-4 -left-2.5 z-10 bg-white border border-primary/20 rounded-[18px] px-4 py-3 shadow-[var(--shadow-md)] flex items-center gap-3 animate-float-slow">
            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary-light))] flex items-center justify-center">
              <CheckCircle2 className="w-[18px] h-[18px] text-primary" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">Event Plan Ready</div>
              <div className="text-[11px] text-muted-foreground">3 vendors confirmed</div>
            </div>
          </div>
        </div>

        {/* Mobile vendor preview — simplified card strip */}
        <div className="lg:hidden mt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Featured Vendors</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {[
              { emoji: "🍽️", name: "Catering", price: "from ₦50k" },
              { emoji: "📸", name: "Photography", price: "from ₦80k" },
              { emoji: "🎵", name: "Entertainment", price: "from ₦30k" },
              { emoji: "🎨", name: "Decoration", price: "from ₦40k" },
            ].map((v) => (
              <Link
                key={v.name}
                to={`/vendor-search?category=${v.name.toLowerCase()}`}
                className="flex-shrink-0 bg-white border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
              >
                <span className="text-2xl">{v.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
