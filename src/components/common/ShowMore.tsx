import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Show the first few items of a long list, with "Show all" / "Show less". */
export function useShowMore<T>(items: T[], initial = 3) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, items.length - initial);
  return {
    visible: expanded ? items : items.slice(0, initial),
    hidden,
    expanded,
    toggle: () => setExpanded((e) => !e),
  };
}

export const ShowMoreButton = ({ hidden, expanded, toggle, noun = "more", className }: {
  hidden: number; expanded: boolean; toggle: () => void; noun?: string; className?: string;
}) => {
  if (hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={expanded}
      className={cn(
        "w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-white/60 py-3 text-sm font-semibold text-primary hover:bg-[hsl(var(--primary-pale))] transition-colors",
        className,
      )}
    >
      {expanded ? <>Show less <ChevronUp className="h-4 w-4" /></> : <>Show {hidden} {noun} <ChevronDown className="h-4 w-4" /></>}
    </button>
  );
};
