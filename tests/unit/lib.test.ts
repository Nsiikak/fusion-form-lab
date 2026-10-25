import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { thumb } from "@/lib/images";
import { CATEGORIES, NIGERIAN_STATES, categoryLabel, categoryValue } from "@/lib/categories";
import { OCCASIONS, allTaskIds } from "@/lib/occasions";

describe("image thumbnails", () => {
  it("asks Cloudinary for a smaller, modern image", () => {
    expect(thumb("https://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_640,c_limit,q_auto,f_auto/v1/a.jpg");
  });
  it("leaves other and already-transformed URLs alone", () => {
    expect(thumb("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    const done = "https://res.cloudinary.com/demo/image/upload/w_300,q_auto/v1/a.jpg";
    expect(thumb(done)).toBe(done);
    expect(thumb(null)).toBe("");
  });
});

describe("categories", () => {
  it("has unique values and labels that round-trip", () => {
    const values = CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
    for (const c of CATEGORIES) {
      expect(categoryLabel(c.value)).toBe(c.label);
      expect(categoryValue(c.label)).toBe(c.value);
    }
  });
  it("matches the backend's VendorCategory enum exactly", () => {
    const model = fs.readFileSync(path.resolve(__dirname, "../../backend/app/entities/vendor/model.py"), "utf8");
    const block = model.slice(model.indexOf("class VendorCategory"), model.indexOf("class", model.indexOf("class VendorCategory") + 10));
    const backend = [...block.matchAll(/=\s*"([a-z_]+)"/g)].map((m) => m[1]).sort();
    expect(CATEGORIES.map((c) => c.value).sort()).toEqual(backend);
  });
  it("lists 36 states and the FCT", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(NIGERIAN_STATES).toContain("FCT");
  });
});

describe("occasion guides", () => {
  it("every occasion has vendors, stages and unique task ids", () => {
    for (const o of OCCASIONS) {
      expect(o.vendors.length).toBeGreaterThan(0);
      const ids = allTaskIds(o);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("only links to real vendor categories", () => {
    const valid = new Set(CATEGORIES.map((c) => c.value));
    for (const o of OCCASIONS) {
      for (const v of o.vendors) expect(valid.has(v.category), `${o.slug}: ${v.category}`).toBe(true);
      for (const s of o.stages) for (const t of s.tasks) if (t.category && t.category !== "venue") expect(valid.has(t.category)).toBe(true);
    }
  });
});
