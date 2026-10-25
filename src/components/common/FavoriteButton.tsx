import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Save a vendor for later (customers). Shared list cached once for all hearts on the page. */
export const useFavorites = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ["favorites"], queryFn: api.account.favorites, enabled: user?.role === "customer", staleTime: 60_000 });
};

const FavoriteButton = ({ vendorId, className }: { vendorId: number; className?: string }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useFavorites();
  if (user && user.role !== "customer") return null;
  const saved = (data as any[]).some((v) => v.id === vendorId);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.info("Sign in to save vendors you like."); return; }
    try {
      if (saved) await api.account.removeFavorite(vendorId); else { await api.account.addFavorite(vendorId); track("vendor_saved", { vendor_id: vendorId }); }
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    } catch { toast.error("Couldn't update your saved vendors."); }
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save vendor"}
      className={cn("h-9 w-9 rounded-full bg-white/95 shadow flex items-center justify-center transition-transform active:scale-90", className)}>
      <Heart className={cn("h-[18px] w-[18px]", saved ? "fill-red-500 text-red-500" : "text-navy")} />
    </button>
  );
};

export const ResponseBadge = ({ hours }: { hours?: number | null }) => {
  if (hours == null) return null;
  const text = hours < 1 ? "Replies within an hour" : hours <= 24 ? `Usually replies within ${Math.ceil(hours)}h` : "Replies within a few days";
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-celebrate-emerald" />{text}</span>;
};

export default FavoriteButton;
