import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Swipeable photo carousel for vendor cards: 1–4+ images, dots, arrows on hover (desktop). */
const ImageCarousel = ({ images, alt, className, children, startIndex = 0, fit = "cover" }: {
  images: string[]; alt: string; className?: string; children?: React.ReactNode; startIndex?: number; fit?: "cover" | "contain";
}) => {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  useEffect(() => {
    const el = track.current;
    if (el && startIndex) el.scrollTo({ left: startIndex * el.clientWidth, behavior: "auto" });
  }, [startIndex]);
  const go = (i: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  return (
    <div className={cn("relative group overflow-hidden", className)}>
      <div ref={track} onScroll={onScroll} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((src, i) => (
          <img key={src + i} src={src} alt={`${alt} photo ${i + 1} of ${images.length}`} loading="lazy"
            className={`h-full w-full flex-none snap-center ${fit === "contain" ? "object-contain" : "object-cover"}`} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => go(index - 1, e)} disabled={index === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-navy shadow flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next photo" onClick={(e) => go(index + 1, e)} disabled={index === images.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-navy shadow flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-white" : "w-1.5 bg-white/60")} />
            ))}
          </div>
        </>
      )}
      {children}
    </div>
  );
};

export default ImageCarousel;
