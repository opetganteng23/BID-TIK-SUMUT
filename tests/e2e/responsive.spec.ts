import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

// Beragam ukuran: ponsel kecil, ponsel potret 9:16 dan lanskap, tablet, laptop, desktop 16:9, ultra lebar, dan 4K.
const SIZES: [string, number, number][] = [
  ["ponsel kecil 320x568", 320, 568],
  ["ponsel 9:16 360x640", 360, 640],
  ["ponsel 390x844", 390, 844],
  ["ponsel besar 430x932", 430, 932],
  ["ponsel lanskap 844x390", 844, 390],
  ["ponsel lanskap kecil 667x375", 667, 375],
  ["tablet potret 768x1024", 768, 1024],
  ["tablet lanskap 1024x768", 1024, 768],
  ["laptop 1366x768", 1366, 768],
  ["desktop 16:9 1920x1080", 1920, 1080],
  ["layar tinggi 9:16 1080x1920", 1080, 1920],
  ["ultra lebar 21:9 3440x1440", 3440, 1440],
  ["4K 3840x2160", 3840, 2160],
];

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, width, height] of SIZES) {
  test(`publik responsif: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of ["/", "/berita", "/layanan", "/kontak", "/pengaduan", "/pengaduan/lacak"]) {
      await page.goto(path);
      expect(await overflowOf(page), `${path} overflow horizontal`).toBeLessThanOrEqual(0);

      // Header selalu terlihat dan seluruh isinya berada di dalam layar.
      const header = page.locator("header.glass");
      await expect(header).toBeVisible();
      const hb = await header.boundingBox();
      expect(hb!.x).toBeGreaterThanOrEqual(0);
      expect(hb!.x + hb!.width).toBeLessThanOrEqual(width + 1);
      const spill = await page.evaluate(() => {
        const h = document.querySelector("header.glass")!;
        const w = document.documentElement.clientWidth;
        return [...h.querySelectorAll("a,button")].filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 0 && (r.right > w + 1 || r.left < -1);
        }).length;
      });
      expect(spill, `${path} elemen header keluar layar`).toBe(0);

      // Footer selebar layar penuh dan menempel di dasar halaman.
      const footer = page.locator("footer");
      await footer.scrollIntoViewIfNeeded();
      const fb = await footer.boundingBox();
      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(Math.abs(fb!.width - (await page.evaluate(() => document.documentElement.clientWidth)))).toBeLessThanOrEqual(1);
      expect(Math.abs(fb!.y + scrollY + fb!.height - docH), `${path} footer tidak di dasar halaman`).toBeLessThanOrEqual(2);
    }
  });
}

test("tangkapan layar: beranda pada beberapa ukuran", async ({ page }) => {
  for (const [name, w, h] of [["320", 320, 640], ["390", 390, 844], ["768", 768, 1024], ["1440", 1440, 900], ["3440", 3440, 1440]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.screenshot({ path: `tests/e2e/__shots__/home-${name}.png`, fullPage: true });
  }
});

test("menu mobile dapat dibuka dan semua tautan terjangkau pada 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Buka menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu navigasi" });
  await expect(drawer).toBeVisible();
  for (const label of ["Beranda", "Berita", "Layanan", "Pengaduan", "Kontak"]) await expect(drawer.getByRole("link", { name: label })).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("panel admin responsif di ponsel, tablet, dan desktop", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [1920, 1080]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const path of ["/admin", "/admin/users", "/admin/news", "/admin/hero", "/admin/settings", "/admin/complaints", "/admin/audit"]) {
      await page.goto(path);
      await expect(page.locator("main#konten")).toBeVisible();
      expect(await overflowOf(page), `${path} @${w}`).toBeLessThanOrEqual(0);
    }
  }
  // menu samping di ponsel: tombol menu tersedia
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Buka menu admin" }).click();
  await expect(page.getByRole("dialog", { name: "Menu admin" })).toBeVisible();
});

for (const path of ["/admin/login", "/admin/forgot-password", "/admin/reset-password?token=abc"]) {
  test(`halaman auth ${path}: ada tautan kembali ke beranda dan kartu terpusat`, async ({ page }) => {
    for (const [w, h] of [[320, 568], [390, 844], [1366, 768], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      const back = page.getByRole("link", { name: "Kembali ke beranda" });
      await expect(back).toBeVisible();
      expect(await overflowOf(page)).toBeLessThanOrEqual(0);
      const card = await page.locator("h1").locator("xpath=..").boundingBox();
      expect(Math.abs(card!.x + card!.width / 2 - w / 2), `kartu terpusat @${w}`).toBeLessThanOrEqual(2);
    }
    await page.getByRole("link", { name: "Kembali ke beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
}
