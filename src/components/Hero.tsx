import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Camera, Lock, Music, Palette, RotateCcw, Search, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { CATEGORIES as ALL_CATEGORIES } from "@/lib/categories";

const CATEGORIES = [{ label: "All categories", value: "" }, ...ALL_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))];

/** Warm tiles shown where real photos will go, until vendors upload their own. */
const TILES = [
  { icon: Palette, label: "Décor & styling", bg: "#E9A15A", fg: "#13213C" },
  { icon: Utensils, label: "Party jollof & small chops", bg: "#F6C987", fg: "#13213C" },
  { icon: Music, label: "DJs & live bands", bg: "#13213C", fg: "#FFF7EC" },
];

const PROMISES = [
  { icon: BadgeCheck, text: "Verified vendors only" },
  { icon: Lock, text: "Vendor paid only when it's done" },
  { icon: RotateCcw, text: "Full refund if they decline" },
];

export const Hero = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  // Real vendor photos for the collage when vendors have uploaded them
  const { data } = useQuery({
    queryKey: ["hero-vendors"],
    queryFn: () => api.vendors.list({ limit: 12 }),
    staleTime: 5 * 60_000,
  });
  const photos: { src: string; name: string }[] = ((data?.vendors as any[]) || [])
    .map((v) => ({ src: v.gallery_images?.[0] || v.profile_image_url, name: v.business_name }))
    .filter((p) => !!p.src)
    .slice(0, 3);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (category) params.set("category", category);
    navigate(`/vendor-search${params.toString() ? `?${params}` : ""}`);
  };

  const tile = (i: number, className: string) => {
    const photo = photos[i];
    const t = TILES[i];
    if (photo) {
      return (
        <div className={`relative overflow-hidden rounded-[26px] ${className}`}>
          <img src={photo.src} alt={photo.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-3 bottom-3 rounded-xl bg-navy/85 px-3 py-1.5 text-xs font-semibold text-navy-foreground">
            {photo.name}
          </span>
        </div>
      );
    }
    const Icon = t.icon;
    return (
      <div className={`relative overflow-hidden rounded-[26px] p-5 flex flex-col justify-between ${className}`} style={{ background: t.bg, color: t.fg }}>
        <Icon className="h-8 w-8 opacity-80" aria-hidden />
        <span className="font-display text-lg font-bold leading-tight">{t.label}</span>
      </div>
    );
  };

  return (
    <section className="relative overflow-hidden bg-background pt-24 sm:pt-32 pb-14 sm:pb-20">
      <div className="absolute inset-0 bg-honeycomb opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />

      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
        {/* Copy */}
        <div className="min-w-0">
          <p className="mb-5 inline-flex items-center rounded-full bg-[hsl(var(--primary-light))] px-3.5 py-2 text-[11.5px] sm:text-[12.5px] font-bold uppercase tracking-wider text-[hsl(var(--primary-deep))]">
            Weddings · Owambes · Birthdays · Corporate
          </p>
          <h1
            className="font-display font-extrabold leading-[1.04] text-foreground mb-5"
            style={{ fontSize: "clamp(36px, 5vw, 60px)", letterSpacing: "-0.035em" }}
          >
            Your caterer, DJ and decorator, <span className="text-accent">sorted.</span>
          </h1>
          <p className="mb-7 max-w-[520px] text-[15.5px] sm:text-lg leading-relaxed text-muted-foreground">
            Compare verified vendors, see real prices in naira, and pay safely. Your money is held until your event is done.
          </p>

          <form
            onSubmit={handleSearch}
            className="flex max-w-[580px] items-center gap-2 rounded-[20px] border border-border bg-white p-2 shadow-[var(--shadow-elevated)]"
          >
            <Search className="ml-2 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden />
            <label htmlFor="hero-search" className="sr-only">What do you need?</label>
            <input
              id="hero-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caterer in Lekki, DJ for a wedding…"
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <label htmlFor="hero-category" className="sr-only">Category</label>
            <select
              id="hero-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="hidden sm:block border-l border-border bg-transparent px-3 py-2 text-sm text-foreground/80 outline-none"
            >
              {CATEGORIES.map((c) => <option key={c.label} value={c.value}>{c.label}</option>)}
            </select>
            <Button type="submit" className="h-auto flex-shrink-0 rounded-[14px] px-4 sm:px-6 py-3 text-[15px] font-bold shadow-[var(--shadow-primary)]">
              <span className="hidden sm:inline">Find vendors</span>
              <span className="sm:hidden">Search</span>
            </Button>
          </form>

          <ul className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6 text-sm font-semibold text-foreground/80">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="h-[18px] w-[18px] flex-shrink-0 text-primary" aria-hidden /> {text}
              </li>
            ))}
          </ul>

          {!isAuthenticated && (
            <p className="mt-7 text-sm text-muted-foreground">
              Run an events business?{" "}
              <Link to="/vendor-registration" className="font-semibold text-primary underline-offset-4 hover:underline">
                List your services free →
              </Link>
            </p>
          )}
        </div>

        {/* Collage — real vendor photos when available */}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-3.5">
          {tile(0, "row-span-2 min-h-[260px] sm:min-h-[420px]")}
          {tile(1, "min-h-[124px] sm:min-h-[203px]")}
          {tile(2, "min-h-[124px] sm:min-h-[203px]")}
        </div>
      </div>
    </section>
  );
};

export default Hero;
