import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarHeart, CheckCircle2, Lightbulb, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { OCCASIONS, occasionBySlug } from "@/lib/occasions";
import { useSeo } from "@/lib/seo";

/** /plan — all occasions; /plan/:slug — one occasion's guide. */
const Plan = () => {
  const { slug } = useParams();
  const occasion = occasionBySlug(slug);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useSeo(occasion ? {
    title: `${occasion.name} planning checklist and vendors`,
    description: `${occasion.tagline} A step-by-step ${occasion.name.toLowerCase()} checklist for Nigeria, and the verified vendors you'll need.`,
    jsonLd: { "@context": "https://schema.org", "@type": "HowTo", name: `How to plan a ${occasion.name.toLowerCase()}`,
      step: occasion.stages.flatMap((st) => st.tasks.map((t) => ({ "@type": "HowToStep", name: t.text }))) },
  } : { title: "Plan an event", description: "Checklists and vendor guides for weddings, birthdays, naming ceremonies, corporate events and more." });

  const start = () => {
    if (!isAuthenticated) return navigate(`/login?next=${encodeURIComponent(`/customer-dashboard?newEvent=${occasion?.slug}`)}`);
    navigate(`/customer-dashboard?newEvent=${occasion?.slug}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 pt-28 pb-20">
        {!occasion ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary-deep))]">Plan an event</p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mt-2">What are you celebrating?</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">Pick an occasion for a step-by-step checklist and the vendors you'll need, then book them safely on Plagohive.</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              {OCCASIONS.map((o) => (
                <Link key={o.slug} to={`/plan/${o.slug}`} className="group rounded-2xl border border-border bg-white p-6 hover:border-primary/40 hover:shadow-[var(--shadow-lg)] transition-all">
                  <CalendarHeart className="h-7 w-7 text-primary" />
                  <h2 className="font-display text-xl font-bold mt-3">{o.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{o.tagline}</p>
                  <p className="text-sm font-semibold text-primary mt-4 flex items-center gap-1">See the guide <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <Link to="/plan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All occasions</Link>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mt-3">{occasion.name}</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">{occasion.tagline}</p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {(!user || user.role === "customer") && (
                <Button onClick={start} className="rounded-xl h-11 px-6">Start planning my {occasion.name.toLowerCase()}</Button>
              )}
              <span className="text-sm text-muted-foreground">{occasion.timeline}</span>
            </div>

            <h2 className="font-display text-2xl font-bold mt-12">Vendors you'll need</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {occasion.vendors.map((v) => (
                <Link key={v.label} to={`/vendor-search?category=${v.category}`} className="rounded-2xl border border-border bg-white p-4 hover:border-primary/40 transition-colors">
                  <p className="font-semibold flex items-center justify-between">{v.label} <Search className="h-4 w-4 text-muted-foreground" /></p>
                  <p className="text-sm text-muted-foreground mt-1">{v.why}</p>
                </Link>
              ))}
            </div>

            <h2 className="font-display text-2xl font-bold mt-12">Your checklist</h2>
            <ol className="mt-4 space-y-6">
              {occasion.stages.map((s) => (
                <li key={s.when} className="relative pl-6 border-l-2 border-[hsl(var(--primary-light))]">
                  <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary-deep))]">{s.when}</p>
                  <ul className="mt-2 space-y-2">
                    {s.tasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-2.5 text-[15px]">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        <span>{t.text}{t.category && <> {" "}<Link to={`/vendor-search?category=${t.category}`} className="text-primary text-sm font-medium hover:underline">Find &rarr;</Link></>}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="mt-10 rounded-2xl bg-[hsl(var(--primary-pale))] border border-[hsl(var(--primary-light))] p-5 flex gap-3">
              <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm">{occasion.tip}</p>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Plan;
