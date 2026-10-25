import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

const noSidewaysScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe("public pages", () => {
  test("home page: honest title, visible logo, fits the screen", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/Book verified event vendors in Nigeria/);
    await expect(page.locator('img[alt="Plagohive"]').first()).toBeVisible();
    await expect(page.getByText("Plan by occasion")).toBeVisible();
    await noSidewaysScroll(page);
  });

  test("login page makes no invented claims", async ({ page }) => {
    await mockApi(page);
    await page.goto("/login");
    await expect(page.getByText("1,000+")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await noSidewaysScroll(page);
  });

  test("search lists vendors from the API", async ({ page }) => {
    await mockApi(page);
    await page.goto("/vendor-search");
    await expect(page.getByText("Mama Ngozi Kitchen").first()).toBeVisible();
    await expect(page.getByText("Kemi Decor Studio").first()).toBeVisible();
    await noSidewaysScroll(page);
  });

  test("city landing page sets an SEO title", async ({ page }) => {
    await mockApi(page);
    await page.goto("/find/catering/lagos");
    await expect(page).toHaveTitle(/Catering in Lagos/);
  });

  test("vendor page has structured data for Google", async ({ page }) => {
    await mockApi(page);
    await page.goto("/vendors/2");
    await expect(page.getByRole("heading", { name: "Mama Ngozi Kitchen" })).toBeVisible();
    const ld = await page.locator("#page-jsonld").textContent();
    expect(JSON.parse(ld || "{}")["@type"]).toBe("LocalBusiness");
  });
});

test.describe("signed-in customer", () => {
  test("booking form: minimum quantity, package, details step", async ({ page }) => {
    await mockApi(page, "customer");
    await page.goto("/vendors/2");
    await page.getByRole("button", { name: /^book now$/i }).first().click();
    await expect(page.getByText("min 50")).toBeVisible();
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await expect(page.locator("text=50").first()).toBeVisible();
    await page.getByRole("button", { name: /^continue/i }).click();
    await expect(page.getByText("When is your event?")).toBeVisible();
    await page.getByRole("button", { name: /choose a start time/i }).click();
    await expect(page.getByRole("button", { name: "4:00 PM" })).toBeVisible();
  });

  test("dashboard: saved vendors sit inside the page, bottom bar on phones", async ({ page }, info) => {
    await mockApi(page, "customer");
    await page.goto("/customer-dashboard");
    const saved = page.getByRole("heading", { name: "Saved vendors" });
    await expect(saved).toBeVisible();
    const box = await saved.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(12);            // not stuck in the top-left corner
    if (info.project.name === "phone") await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await noSidewaysScroll(page);
  });
});

test.describe("support team", () => {
  test("support staff land on the support workspace and can't open admin", async ({ page }) => {
    await mockApi(page, "support");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("heading", { name: "Support" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Look up" })).toBeVisible();
  });
});
