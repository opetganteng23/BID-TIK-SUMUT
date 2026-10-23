import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/berita", "/layanan", "/kontak", "/pengaduan", "/pengaduan/lacak", "/admin/login"];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const theme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`axe tanpa pelanggaran: ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("a11y", JSON.stringify({ theme: t })), theme);
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await axe(page)).toEqual([]);
    });
  }
}

test("kontras tinggi dan font ramah disleksia lolos axe", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("a11y", JSON.stringify({ theme: "light", contrast: true, dyslexia: true, spacing: "loose" })));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await expect(page.locator("html")).toHaveAttribute("data-font", "dyslexia");
  expect(await axe(page)).toEqual([]);
});

for (const width of [360, 768, 1024, 1440]) {
  test(`tanpa scroll horizontal pada lebar ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/berita", "/kontak", "/pengaduan"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test("zoom teks 150% tanpa scroll horizontal di 360px", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("a11y", JSON.stringify({ theme: "light", fontLevel: 4, fontScale: 1.5 })));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("skip link menjadi fokus pertama dan memindahkan ke konten", async ({ page }) => {
  await page.goto("/kontak");
  await page.keyboard.press("Tab");
  const first = page.getByRole("link", { name: "Lewati ke konten" });
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#konten$/);
});

test("header glass, hero, running text, berita, fitur, footer tampil", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header.glass")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sorotan utama" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Informasi berjalan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Berita Terbaru" })).toBeVisible();
  await expect(page.getByRole("link", { name: /More Detail/ }).first()).toBeVisible();
  await expect(page.locator("footer")).toContainText("Alamat contoh");
  const backdrop = await page.locator("header.glass").evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(backdrop).toContain("blur");
  await page.screenshot({ path: "tests/e2e/__shots__/home-desktop.png", fullPage: true });
});

test("widget aksesibilitas: tema, ukuran font, kurangi animasi, reset, dan persisten", async ({ page }) => {
  await page.goto("/kontak");
  await page.getByRole("button", { name: /Aksesibilitas/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pengaturan aksesibilitas" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "Gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByRole("button", { name: "Perbesar font" }).click();
  const size = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(size)).toBeGreaterThan(16);
  await dialog.getByLabel("Kurangi animasi").check();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /Aksesibilitas/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kembalikan ke bawaan" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-motion", "reduce");
});

test("carousel hero berhenti total saat kurangi animasi aktif", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("a11y", JSON.stringify({ theme: "light", reduceMotion: true })));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Sorotan utama" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Putar otomatis" })).toBeDisabled();
});

test("daftar dan detail berita dapat dibuka dari kartu, ada tombol Dengarkan", async ({ page }) => {
  await page.goto("/berita");
  await page.getByRole("link", { name: /Berita Uji E2E/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Berita Uji E2E/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dengarkan" })).toBeVisible();
  await expect(page.getByText("Paragraf pertama berita uji.")).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("detail layanan terbuka lewat More Detail", async ({ page }) => {
  await page.goto("/layanan");
  await page.getByRole("link", { name: /More Detail: Fitur Uji/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Fitur Uji/ })).toBeVisible();
  await expect(page.getByText("Isi fitur uji.")).toBeVisible();
});

test("formulir kontak: validasi error dan sukses", async ({ page }) => {
  await page.goto("/kontak");
  await page.getByLabel("Nama", { exact: true }).fill("A");
  await page.getByLabel("Email", { exact: true }).fill("bukan-email");
  await page.getByLabel("Subjek").fill("Hai");
  await page.getByLabel("Pesan").fill("pendek");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toBeVisible();
  await page.getByLabel("Nama", { exact: true }).fill("Budi Contoh");
  await page.getByLabel("Email", { exact: true }).fill("budi@example.test");
  await page.getByLabel("Subjek").fill("Pertanyaan uji e2e");
  await page.getByLabel("Pesan").fill("Ini pesan uji yang cukup panjang untuk lolos validasi.");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByText("Pesan Anda telah kami terima")).toBeVisible();
});

test("halaman tidak ditemukan", async ({ page }) => {
  const res = await page.goto("/halaman-yang-tidak-ada-xyz");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});
