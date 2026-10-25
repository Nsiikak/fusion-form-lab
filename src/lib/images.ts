/** Smaller, modern-format images from Cloudinary for cards (saves mobile data). Other URLs pass through. */
export function thumb(url?: string | null, width = 640): string {
  if (!url) return "";
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m) return url;
  if (/^(?:[a-z]_[^/]+,?)+\//.test(m[2])) return url;            // already transformed
  return `${m[1]}w_${width},c_limit,q_auto,f_auto/${m[2]}`;
}
