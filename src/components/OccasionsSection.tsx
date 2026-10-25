import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { OCCASIONS } from "@/lib/occasions";

/** Home page: "Plan by occasion" — entry points into the occasion guides. */
export const OccasionsSection = () => (
  <section className="relative py-16 sm:py-20 bg-background">
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary-deep))]">Plan by occasion</p>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Everything you need, in the right order</h2>
        <Link to="/plan" className="text-sm font-semibold text-primary flex items-center gap-1">All guides <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-8 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible">
        {OCCASIONS.map((o, i) => (
          <Link key={o.slug} to={`/plan/${o.slug}`}
            className={`snap-start flex-none w-[78%] sm:w-auto rounded-3xl p-6 border transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] ${i === 0 ? "bg-navy text-navy-foreground border-navy" : "bg-white border-border"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-celebrate-gold" : "text-muted-foreground"}`}>{o.timeline}</p>
            <h3 className="font-display text-2xl font-bold mt-2">{o.name}</h3>
            <p className={`text-sm mt-2 ${i === 0 ? "text-navy-foreground/80" : "text-muted-foreground"}`}>{o.tagline}</p>
            <p className={`text-sm mt-4 ${i === 0 ? "text-navy-foreground/80" : "text-muted-foreground"}`}>{o.vendors.length} vendor types &middot; {o.stages.reduce((n, s) => n + s.tasks.length, 0)}-step checklist</p>
          </Link>
        ))}
      </div>
    </div>
  </section>
);
