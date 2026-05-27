const testimonials = [
  {
    stars: "★★★★★",
    quote:
      "I found my caterer, decorator, and photographer all in one afternoon. Plagohive saved me weeks of stress planning my daughter's wedding. Everything was seamless.",
    initials: "NG",
    avatarBg: "bg-white/20",
    name: "Ngozi Eze",
    role: "Customer · Abuja",
  },
  {
    stars: "★★★★★",
    quote:
      "My catering business has grown 3× since joining Plagohive. The verified badge alone brings more customers than word of mouth ever could.",
    initials: "CK",
    avatarBg: "bg-accent/40",
    name: "Chidi Kanu",
    role: "Vendor · Lagos",
  },
  {
    stars: "★★★★★",
    quote:
      "The budget filter is a game changer. I set my range and only saw vendors I could afford. Booking was instant and the payment was fully protected.",
    initials: "IM",
    avatarBg: "bg-white/15",
    name: "Ifunanya Madu",
    role: "Customer · Port Harcourt",
  },
];

export const Testimonials = () => {
  return (
    <section
      id="testimonials"
      className="relative py-24 px-[5vw] overflow-hidden"
      style={{ background: "var(--gradient-testimonial)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -top-24 -right-24 w-[400px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(29 100% 48% / 0.15) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-[1200px] mx-auto relative">
        <div className="text-center">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-white/50 mb-3.5">
            What people say
          </div>
          <h2
            className="font-display font-extrabold text-white leading-[1.1]"
            style={{ fontSize: "clamp(28px, 3vw, 44px)", letterSpacing: "-0.035em" }}
          >
            Loved across Nigeria
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white/10 border border-white/15 rounded-2xl backdrop-blur-md p-7 hover:bg-white/15 transition-colors"
            >
              <div className="text-[hsl(var(--accent-mid))] text-sm mb-3.5">{t.stars}</div>
              <p className="text-[14.5px] leading-[1.75] text-white/90 italic font-light mb-5">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-display text-sm font-extrabold text-white ${t.avatarBg}`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-xs text-white/50">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
