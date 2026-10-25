import { useEffect } from "react";

const SITE = "Plagohive";
const DEFAULT_IMAGE = "/og-image.png";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

/** Per-page title, description, sharing preview, canonical URL and structured data (JSON-LD). */
export function useSeo({ title, description, image, path, jsonLd, noindex = false }: {
  title: string; description?: string; image?: string | null; path?: string; jsonLd?: object | null; noindex?: boolean;
}) {
  useEffect(() => {
    const full = title.includes(SITE) ? title : `${title} · ${SITE}`;
    document.title = full;
    const desc = description || "Book verified event vendors in Nigeria. Your payment is held until your event is done.";
    const url = `${window.location.origin}${path ?? window.location.pathname}`;
    const img = image ? (image.startsWith("http") ? image : `${window.location.origin}${image}`) : `${window.location.origin}${DEFAULT_IMAGE}`;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", img);
    setMeta("name", "twitter:title", full);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
    setMeta("name", "robots", noindex ? "noindex" : "index,follow");
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = url;
    let ld = document.getElementById("page-jsonld");
    if (jsonLd) {
      if (!ld) { ld = document.createElement("script"); ld.id = "page-jsonld"; (ld as HTMLScriptElement).type = "application/ld+json"; document.head.appendChild(ld); }
      ld.textContent = JSON.stringify(jsonLd);
    } else if (ld) ld.remove();
  }, [title, description, image, path, noindex, JSON.stringify(jsonLd)]);
}
