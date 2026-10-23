import { describe, expect, it } from "vitest";
import { transition, isPubliclyVisible } from "@/lib/news-state";
import { canTransition, confirmationDeadline, CONFIRMATION_WINDOW_MS } from "@/lib/complaint-state";
import { generateAccessCode, generateTicketNumber, hashAccessCode, verifyAccessCode } from "@/lib/complaint-codes";
import { sanitizeContent } from "@/lib/sanitize";
import { can } from "@/lib/rbac";
import { slugify, isReservedSlug } from "@/lib/slug";
import { safeCell } from "@/lib/xlsx-safe";
import { phoneSchema, createComplaintSchema } from "@/lib/complaint-schemas";
import { matchesSignature } from "@/lib/media";
import { assertNoOperators } from "@/lib/http";
import { assertCanManageUser } from "@/lib/user-policy";
import { buildSort } from "@/lib/listing";

describe("news state machine", () => {
  it("editor can submit own draft but cannot publish or approve", () => {
    expect(transition({ action: "submit_review", from: "draft", role: "editor", isOwner: true })).toEqual({ ok: true, to: "review" });
    expect(transition({ action: "publish", from: "review", role: "editor", isOwner: true })).toMatchObject({ ok: false, reason: "forbidden" });
    expect(transition({ action: "approve", from: "review", role: "editor", isOwner: true })).toMatchObject({ ok: false, reason: "forbidden" });
  });
  it("editor cannot submit a draft owned by another user", () => {
    expect(transition({ action: "submit_review", from: "draft", role: "editor", isOwner: false })).toMatchObject({ ok: false });
  });
  it("rejects invalid transitions", () => {
    expect(transition({ action: "approve", from: "draft", role: "admin", isOwner: false })).toMatchObject({ ok: false, reason: "invalid" });
    expect(transition({ action: "restore", from: "published", role: "admin", isOwner: false })).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("scheduled news is visible only after publishedAt", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isPubliclyVisible({ status: "scheduled", publishedAt: new Date("2026-02-01") }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "scheduled", publishedAt: new Date("2025-12-01") }, now)).toBe(true);
    expect(isPubliclyVisible({ status: "archived", publishedAt: new Date("2025-12-01") }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "draft", publishedAt: new Date("2025-12-01") }, now)).toBe(false);
  });
});

describe("complaint state machine", () => {
  it("allows only approved transitions", () => {
    expect(canTransition("submitted", "in_progress", "admin")).toBe(true);
    expect(canTransition("in_progress", "awaiting_reporter_confirmation", "admin")).toBe(true);
    expect(canTransition("awaiting_reporter_confirmation", "closed", "reporter")).toBe(true);
    expect(canTransition("awaiting_reporter_confirmation", "closed", "system")).toBe(true);
    expect(canTransition("awaiting_reporter_confirmation", "in_progress", "reporter")).toBe(true);
    expect(canTransition("waiting_reporter", "in_progress", "reporter")).toBe(true);
  });
  it("rejects shortcuts and reopening closed tickets", () => {
    expect(canTransition("submitted", "closed", "admin")).toBe(false);
    expect(canTransition("in_progress", "closed", "admin")).toBe(false);
    expect(canTransition("closed", "in_progress", "reporter")).toBe(false);
    expect(canTransition("closed", "in_progress", "admin")).toBe(false);
    expect(canTransition("in_progress", "closed", "system")).toBe(false);
    expect(canTransition("awaiting_reporter_confirmation", "closed", "admin")).toBe(false);
  });
  it("deadline is exactly 7 x 24 hours", () => {
    const t = new Date("2026-03-01T00:00:00Z");
    expect(confirmationDeadline(t).getTime() - t.getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(CONFIRMATION_WINDOW_MS).toBe(604_800_000);
  });
});

describe("complaint codes", () => {
  it("generates unguessable, well-formed values", () => {
    expect(generateTicketNumber()).toMatch(/^PGD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const code = generateAccessCode();
    expect(code).toMatch(/^([A-Z2-9]{5}-){3}[A-Z2-9]{5}$/);
    expect(new Set(Array.from({ length: 200 }, generateAccessCode)).size).toBe(200);
  });
  it("verifies only the right code, ignoring formatting", () => {
    const pepper = "p".repeat(32);
    const code = generateAccessCode();
    const hash = hashAccessCode(code, pepper);
    expect(hash).not.toContain(code.replace(/-/g, ""));
    expect(verifyAccessCode(code.toLowerCase().replace(/-/g, " "), hash, pepper)).toBe(true);
    expect(verifyAccessCode("AAAAA-AAAAA-AAAAA-AAAAA", hash, pepper)).toBe(false);
    expect(verifyAccessCode(code, hash, "q".repeat(32))).toBe(false);
  });
});

describe("html sanitizer", () => {
  const bad = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example/x"></iframe>',
    '<p style="x:expression(alert(1))">a</p>',
    '<form action="/x"><input name=a></form>',
    '<object data="x"></object><embed src="x">',
    '<img src="data:image/png;base64,AAAA">',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  ];
  it.each(bad)("neutralises %s", (payload) => {
    const out = sanitizeContent(payload).toLowerCase();
    for (const needle of ["<script", "onerror", "javascript:", "evil.example", "style=", "<form", "<input", "<object", "<embed", "data:"]) {
      expect(out).not.toContain(needle);
    }
  });
  it("keeps allowed markup and hardens target=_blank", () => {
    const out = sanitizeContent('<p>Halo <strong>dunia</strong> <a href="https://example.com" target="_blank">tautan</a></p>');
    expect(out).toContain("<strong>dunia</strong>");
    expect(out).toContain('rel="noopener noreferrer"');
  });
  it("allows only whitelisted video embeds", () => {
    expect(sanitizeContent('<iframe src="https://www.youtube-nocookie.com/embed/abc" title="v"></iframe>')).toContain("youtube-nocookie");
    expect(sanitizeContent('<iframe src="https://www.youtube.com/watch?v=abc"></iframe>')).not.toContain("iframe");
  });
});

describe("rbac", () => {
  it("enforces the matrix", () => {
    expect(can("editor", "users.manage")).toBe(false);
    expect(can("editor", "news.manage_others")).toBe(false);
    expect(can("editor", "complaints.export")).toBe(false);
    expect(can("admin", "news.raw")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
    expect(can("editor", "users.manage")).toBe(false);
    expect(can("admin", "complaints.export")).toBe(true);
    expect(can("admin", "complaints.export_sensitive")).toBe(false);
    expect(can("super_admin", "news.raw")).toBe(true);
    expect(can("super_admin", "complaints.export_sensitive")).toBe(true);
  });
});

describe("user policy", () => {
  it("admin tidak boleh menyentuh atau memberi peran super_admin", () => {
    expect(() => assertCanManageUser("admin", "super_admin")).toThrow();
    expect(() => assertCanManageUser("admin", "editor", "super_admin")).toThrow();
    expect(() => assertCanManageUser("admin", "editor", "admin")).not.toThrow();
    expect(() => assertCanManageUser("super_admin", "super_admin", "admin")).not.toThrow();
  });
});

describe("helpers", () => {
  it("slugify and reserved slugs", () => {
    expect(slugify("Pelayanan Prima: Edisi #1!")).toBe("pelayanan-prima-edisi-1");
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("profil")).toBe(false);
  });
  it("neutralises xlsx formula injection", () => {
    for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "\rx"]) expect(String(safeCell(v)).startsWith("'")).toBe(true);
    expect(safeCell("biasa")).toBe("biasa");
  });
  it("validates Indonesian phone numbers", () => {
    expect(phoneSchema.safeParse("0812-3456-7890").success).toBe(true);
    expect(phoneSchema.safeParse("+6281234567890").success).toBe(true);
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("0212345678").success).toBe(false);
  });
  it("requires privacy consent on complaints and rejects unknown fields", () => {
    const base = {
      name: "Budi Contoh",
      address: "Jalan Contoh 1",
      phone: "081234567890",
      region: "medan",
      categoryId: "a".repeat(24),
      subject: "Subjek contoh",
      description: "x".repeat(30),
    };
    expect(createComplaintSchema.safeParse({ ...base, privacyConsent: true }).success).toBe(true);
    expect(createComplaintSchema.safeParse({ ...base, privacyConsent: false }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, privacyConsent: true, status: "closed" }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, region: undefined, privacyConsent: true }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, region: "atlantis", privacyConsent: true }).success).toBe(false);
  });
  it("buildSort hanya menerima kolom whitelist", () => {
    expect(buildSort("name", "desc", ["name"], { x: 1 })).toEqual({ name: -1, _id: -1 });
    expect(buildSort(undefined, undefined, ["name"], { x: 1 })).toEqual({ x: 1 });
    expect(() => buildSort("passwordHash", "asc", ["name"], { x: 1 })).toThrow();
  });
  it("checks magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(matchesSignature("image/png", png)).toBe(true);
    expect(matchesSignature("image/jpeg", png)).toBe(false);
    expect(matchesSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(matchesSignature("application/pdf", new TextEncoder().encode("MZ......"))).toBe(false);
  });
  it("rejects $-operators and dotted keys (NoSQL injection)", () => {
    expect(() => assertNoOperators({ a: { $ne: null } })).toThrow();
    expect(() => assertNoOperators({ "a.b": 1 })).toThrow();
    expect(() => assertNoOperators({ list: [{ $gt: 1 }] })).toThrow();
    expect(() => assertNoOperators({ a: { b: "ok" } })).not.toThrow();
  });
});
