import { expect, test } from "@playwright/test";

test("hero memuat judul besar, subjudul, dan paragraf resmi Bid TIK", async ({ page }) => {
  await page.goto("/");
  // Slide tidak aktif ber-aria-hidden, jadi dicari lewat CSS, bukan peran.
  const slide = page.locator("section[aria-label='Sorotan utama'] [aria-roledescription='slide']").filter({ has: page.locator("h2", { hasText: /^Bidang TIK$/ }) });
  await expect(slide).toHaveCount(1);
  await expect(slide.locator("h2")).toHaveText("Bidang TIK");
  await expect(slide).toContainText("Polda Sumatera Utara");
  await expect(slide).toContainText("unsur pengawas dan pembantu pimpinan dalam bidang teknologi informasi dan komunikasi");
  await expect(slide.locator("img[src='/brand/tik-polri.png']")).toHaveCount(1);
});

test("berita di beranda berupa slider yang dapat digeser", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const slider = page.getByRole("region", { name: "Slider berita" });
  await expect(slider).toBeVisible();
  const slides = slider.getByRole("group", { name: /dari/ });
  expect(await slides.count()).toBeGreaterThan(3);
  const next = slider.getByRole("button", { name: "Berita berikutnya" });
  const prev = slider.getByRole("button", { name: "Berita sebelumnya" });
  await expect(prev).toBeDisabled();
  const track = slider.locator("div.flex").first();
  const x0 = (await track.boundingBox())!.x;
  await next.click();
  await expect.poll(async () => (await track.boundingBox())!.x, { timeout: 5000 }).toBeLessThan(x0 - 50);
  await expect(prev).toBeEnabled();
  await prev.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await track.boundingBox())!.x, { timeout: 5000 }).toBeGreaterThan(x0 - 5);
});

test("slider berita: 1 kartu di ponsel dan tidak ada overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const first = page.getByRole("region", { name: "Slider berita" }).getByRole("group", { name: /^1 dari/ });
  const box = (await first.boundingBox())!;
  expect(box.width).toBeGreaterThan(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("footer hanya memuat hak cipta OPETHANDAUGER", async ({ page }) => {
  await page.goto("/kontak");
  const footer = page.locator("footer");
  await expect(footer).toContainText("© 2026 OPETHANDAUGER");
  await expect(footer).not.toContainText("© 2026 BID TIK Polda Sumatera Utara");
});

test("running text berisi kata-kata", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Informasi berjalan" }).first()).toBeVisible();
});

test("menu dan alamat memakai kata Layanan; /fitur dialihkan ke /layanan", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Layanan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Layanan", level: 2 }).first()).toBeVisible();
  const res = await page.goto("/fitur");
  expect(page.url()).toMatch(/\/layanan$/);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Layanan" })).toBeVisible();
});

test("favicon memakai lambang TIK Polri", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator("link[rel='icon']").first().getAttribute("href");
  expect(href).toMatch(/icon/);
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect((await res.body()).length).toBeGreaterThan(5000);
});
