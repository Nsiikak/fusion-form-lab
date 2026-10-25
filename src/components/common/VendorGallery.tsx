import { useState } from "react";
import { Images } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import ImageCarousel from "@/components/common/ImageCarousel";

/** All of a vendor's photos: a swipeable gallery, thumbnails, and a full-screen viewer. */
const VendorGallery = ({ images, name }: { images: string[]; name: string }) => {
  const [viewer, setViewer] = useState<number | null>(null);
  if (!images?.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Photos</h2>
        <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Images className="h-4 w-4" /> {images.length}</span>
      </div>
      <button type="button" onClick={() => setViewer(0)} className="block w-full rounded-2xl overflow-hidden" aria-label="Open photos full screen">
        <ImageCarousel images={images} alt={name} className="aspect-[4/3] sm:aspect-video w-full bg-muted" />
      </button>
      {images.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
          {images.map((src, i) => (
            <button key={src + i} type="button" onClick={() => setViewer(i)} className="aspect-square rounded-xl overflow-hidden border border-border hover:opacity-90"
              aria-label={`Open photo ${i + 1}`}>
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={viewer !== null} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-5xl w-[calc(100%-1rem)] p-0 bg-black border-0 overflow-hidden">
          <DialogTitle className="sr-only">{name} photos</DialogTitle>
          <DialogDescription className="sr-only">Swipe or use the arrows to see every photo.</DialogDescription>
          {viewer !== null && <ImageCarousel images={images} alt={name} startIndex={viewer} fit="contain" className="h-[80vh] w-full" />}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VendorGallery;
