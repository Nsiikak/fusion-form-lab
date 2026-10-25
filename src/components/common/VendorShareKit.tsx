import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, BadgeCheck, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CardFormat, download, statsCard, verifiedCard } from "@/lib/shareCards";
import { formatNaira } from "@/lib/utils";

/** Vendor dashboard card: download a "Verified · Now accepting bookings" card and a stats card for socials. */
const VendorShareKit = ({ vendor, stats }: { vendor: any; stats: any }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const verified = vendor?.verification_status === "approved";
  const url = `${window.location.host.replace(/^www\./, "")}/vendors/${vendor?.id ?? ""}`;
  const slug = (vendor?.business_name || "vendor").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const run = async (key: string, fn: () => Promise<HTMLCanvasElement>, name: string) => {
    setBusy(key);
    try { download(await fn(), name); toast.success("Saved: post it on Instagram, WhatsApp Status or TikTok."); }
    catch { toast.error("Couldn't create the image. Please try again."); }
    finally { setBusy(null); }
  };

  const info = () => ({
    businessName: vendor.business_name, category: vendor.category, location: vendor.location,
    photo: vendor.gallery_images?.[0] || vendor.profile_image_url, url,
  });
  const statItems = () => {
    const items = [
      { label: "Events completed", value: String(stats?.completed_bookings ?? 0) },
      { label: "Happy clients", value: String(stats?.total_clients ?? 0) },
      { label: stats?.total_reviews ? `Rating (${stats.total_reviews} reviews)` : "Reviews", value: stats?.total_reviews ? `${Number(stats.average_rating).toFixed(1)}\u2605` : "New" },
      { label: "Bookings", value: String(stats?.total_bookings ?? 0) },
    ];
    if (showEarnings) items[3] = { label: "Earned on Plagohive", value: formatNaira(stats?.total_earnings ?? 0).replace(".00", "") };
    return items;
  };

  const Btn = ({ k, label, fn, name }: { k: string; label: string; fn: () => Promise<HTMLCanvasElement>; name: string }) => (
    <Button variant="outline" size="sm" className="rounded-lg" disabled={!!busy} onClick={() => run(k, fn, name)}>
      {busy === k ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} {label}
    </Button>
  );

  if (!vendor) return null;
  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Share on socials</h3>
        <p className="text-xs text-muted-foreground">Ready-made images in the Plagohive style. Your customers see you're verified and protected.</p>
      </div>
      <div className="flex items-start gap-3">
        <BadgeCheck className="h-5 w-5 text-celebrate-emerald mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">"Verified · Now accepting bookings"</p>
          {verified ? (
            <div className="flex flex-wrap gap-2 mt-2">
              <Btn k="v-sq" label="Square post" fn={() => verifiedCard(info(), "square")} name={`${slug}-verified-post.png`} />
              <Btn k="v-st" label="Story / Status" fn={() => verifiedCard(info(), "story")} name={`${slug}-verified-story.png`} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Available once your profile is verified.</p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <BarChart3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">My Plagohive numbers</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
            <Checkbox checked={showEarnings} onCheckedChange={(v) => setShowEarnings(!!v)} /> Include my earnings
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            <Btn k="s-sq" label="Square post" fn={() => statsCard({ businessName: vendor.business_name, stats: statItems(), url }, "square")} name={`${slug}-stats-post.png`} />
            <Btn k="s-st" label="Story / Status" fn={() => statsCard({ businessName: vendor.business_name, stats: statItems(), url }, "story")} name={`${slug}-stats-story.png`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorShareKit;
