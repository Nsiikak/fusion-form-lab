/** Product analytics (PostHog). Off unless VITE_POSTHOG_KEY is set; never sends payment or card data.
 *  Funnel: search → vendor_viewed → service_added → checkout_started → payment_succeeded. */
type Props = Record<string, string | number | boolean | null | undefined>;
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.i.posthog.com";
let queue: [string, Props][] = [];

export function initAnalytics() {
  if (!KEY || (window as any).posthog) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `${HOST.replace(".i.", "-assets.i.")}/static/array.js`;
  s.onload = () => {
    const ph = (window as any).posthog;
    if (!ph) return;
    ph.init(KEY, { api_host: HOST, person_profiles: "identified_only", capture_pageview: true });
    queue.forEach(([e, p]) => ph.capture(e, p)); queue = [];
  };
  document.head.appendChild(s);
}

export function track(event: string, props: Props = {}) {
  if (!KEY) return;
  const ph = (window as any).posthog;
  if (ph?.capture) ph.capture(event, props); else queue.push([event, props]);
}

export function identify(user: { id: number; role?: string } | null) {
  const ph = (window as any).posthog;
  if (!KEY || !ph?.identify || !user) return;
  ph.identify(String(user.id), { role: user.role });   // id and role only: no names, emails or phone numbers
}
