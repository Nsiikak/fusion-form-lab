const partners = [
  "WeddingHQ Nigeria",
  "EventsNG",
  "Lagos Catering Guild",
  "Afri-Events Pro",
  "Decor Hub Africa",
];

export const TrustedStrip = () => {
  return (
    <div className="border-y border-border bg-secondary py-6 px-[5vw]">
      <div className="max-w-[1200px] mx-auto flex items-center gap-7 flex-wrap">
        <span className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">
          Trusted by
        </span>
        <div className="w-px h-5 bg-primary/20" />
        <div className="flex gap-7 items-center flex-wrap">
          {partners.map((p) => (
            <span
              key={p}
              className="font-display text-[13.5px] font-bold text-muted-foreground opacity-55 hover:opacity-90 transition-opacity"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
