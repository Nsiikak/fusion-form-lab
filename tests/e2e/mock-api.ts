import type { Page } from "@playwright/test";

const vendor = {
  id: 2, business_name: "Mama Ngozi Kitchen", category: "catering", location: "Ikeja, Lagos", base_state: "Lagos",
  description: "Party jollof, small chops and native soups.", starting_price: 3360, logistics_fee: 15000, verification_status: "approved",
  is_active: true, gallery_images: [], profile_image_url: null, average_rating: 4.8, total_reviews: 12, response_hours: 2,
  cancellation_policy: "standard",
};
const users: Record<string, any> = {
  customer: { id: 10, email: "ada@example.com", full_name: "Ada Okafor", role: "customer", phone_number: "08031234567", is_active: true },
  support: { id: 11, email: "sade@example.com", full_name: "Sade Support", role: "support", is_active: true },
};

/** Answer every API call the app makes with realistic data. `as` signs the browser in as that role. */
export async function mockApi(page: Page, as?: "customer" | "support") {
  if (as) await page.addInitScript(() => { localStorage.setItem("auth_token", "e2e-token"); localStorage.setItem("refresh_token", "e2e-refresh"); });
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/auth/me") return as ? json(users[as]) : json({ detail: "Not authenticated" }, 401);
    if (p === "/api/vendors") return json({ vendors: [vendor, { ...vendor, id: 3, business_name: "Kemi Decor Studio", category: "decoration" }], total: 2, page: 1, total_pages: 1 });
    if (p === "/api/vendors/recommended") return json([vendor]);
    if (/^\/api\/vendors\/\d+\/availability$/.test(p)) return json({ unavailable: [] });
    if (/^\/api\/vendors\/\d+$/.test(p)) return json(vendor);
    if (/^\/api\/service-items\/vendor\/\d+$/.test(p)) return json([
      { id: 1, name: "Party jollof", unit_price: 3360, unit_label: "per plate", pricing_type: "unit", min_quantity: 50, is_active: true },
      { id: 2, name: "Gold wedding package", unit_price: 1200000, unit_label: "package", pricing_type: "package", min_quantity: 1, included: ["Setup", "6 servers"], is_active: true },
    ]);
    if (p.startsWith("/api/reviews")) return json([]);
    if (p === "/api/bookings/quote") return json({ base_price: 0, items_total: 168000, vendor_service_fee: 0, logistics_fee: 15000, vendor_total: 183000,
      platform_fee: 4575, customer_total: 187575, items: [{ service_item_id: 1, name: "Party jollof", quantity: 50, unit_price: 3360, subtotal: 168000 }], advance_amount: 0 });
    if (p === "/api/bookings/policies") return json({ standard: { key: "standard", label: "Standard", summary: "", tiers: [[14, 100], [7, 50], [2, 25]] } });
    if (p === "/api/bookings" || p === "/api/events" || p === "/api/account/favorites") return json(p === "/api/account/favorites" ? [vendor] : []);
    if (p === "/api/messages/unread-count") return json({ unread: 0 });
    if (p.startsWith("/api/stats")) return json({});
    if (p === "/api/support/cases" || p === "/api/support/upcoming" || p === "/api/support/escalations" || p === "/api/support/notifications") return json([]);
    return json([]);
  });
}
