import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
}

test("login salah menampilkan error generik", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("tidak-ada@example.test");
  await page.getByLabel("Password").fill("salah-salah-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("Email atau password salah");
});

test("halaman admin tanpa sesi dialihkan ke login", async ({ page }) => {
  await page.goto("/admin/news");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin: dashboard, navigasi, dan halaman utama lolos axe", async ({ page }) => {
  await loginAdmin(page);
  for (const path of ["/admin", "/admin/news", "/admin/hero", "/admin/features", "/admin/pages", "/admin/settings", "/admin/media", "/admin/messages", "/admin/users", "/admin/audit", "/admin/complaints"]) {
    await page.goto(path);
    await expect(page.locator("main#konten")).toBeVisible();
    await expect(page.getByText("Terjadi kesalahan")).toHaveCount(0);
    const v = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations.map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(v, path).toEqual([]);
  }
});

test("admin: buat berita lewat editor, simpan, terbitkan, tampil di publik", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/news");
  await page.getByRole("button", { name: "Berita baru" }).click();
  const title = `Berita UI ${Date.now()}`;
  await page.getByLabel("Judul", { exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Isi berita" }).click();
  await page.keyboard.type("Isi berita dari editor rich text.");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Berita disimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Terbitkan sekarang" }).click();
  await expect(page.getByText(/Status berubah menjadi Terbit/)).toBeVisible();
  await page.goto("/berita");
  await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
});

test("admin: peringatan perubahan belum disimpan muncul", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/hero");
  await page.getByRole("button", { name: "Tambah slide" }).click();
  await page.getByLabel("Judul", { exact: true }).fill("Draf slide");
  await expect(page.getByRole("status").filter({ hasText: "Perubahan belum disimpan" })).toBeVisible();
});

test("pengaduan: ajukan, simpan kode, lacak, balas, lalu klaim dan selesaikan oleh admin", async ({ page, browser }) => {
  await page.goto("/pengaduan");
  await page.getByLabel("Nama lengkap").fill("Warga Fiktif");
  await page.getByLabel("Alamat").fill("Jalan Fiktif No. 1, Kota Contoh");
  await page.getByLabel("Nomor telepon").fill("081234567890");
  await page.getByLabel("Kategori").selectOption({ index: 1 });
  await page.getByLabel("Subjek").fill("Pengaduan fiktif uji e2e");
  await page.getByLabel("Uraian pengaduan").fill("Ini uraian pengaduan fiktif untuk pengujian end to end sistem.");
  // tanpa persetujuan privasi: ditolak
  await page.getByRole("button", { name: "Kirim pengaduan" }).click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toBeVisible();
  await page.getByLabel(/menyetujui pemberitahuan privasi/).check();
  await page.getByRole("button", { name: "Kirim pengaduan" }).click();

  await expect(page.getByText("Simpan data berikut sekarang")).toBeVisible();
  const ticket = await page.getByLabel("Nomor tiket").inputValue();
  const code = await page.getByLabel("Kode akses rahasia").inputValue();
  expect(ticket).toMatch(/^PGD-/);
  expect(page.url()).not.toContain(code);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(code);

  // sesi baru (tanpa cookie) harus memasukkan tiket dan kode
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("/pengaduan/lacak");
  await p2.getByLabel("Nomor tiket").fill(ticket);
  await p2.getByLabel("Kode akses").fill("SALAH-SALAH-SALAH-SALAH");
  await p2.getByRole("button", { name: "Buka tiket" }).click();
  await expect(p2.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("tidak valid");
  await p2.getByLabel("Kode akses").fill(code);
  await p2.getByRole("button", { name: "Buka tiket" }).click();
  await expect(p2.getByText("Belum Diambil").first()).toBeVisible();
  expect(p2.url()).not.toContain(code);
  expect((await new AxeBuilder({ page: p2 }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await p2.getByLabel("Balas petugas").fill("Pesan pelapor <b>uji</b>");
  await p2.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(p2.getByText("Pesan pelapor <b>uji</b>")).toBeVisible(); // tampil literal, bukan HTML

  // admin klaim dan menyatakan selesai
  const admin = await ctx.newPage();
  await loginAdmin(admin);
  await admin.goto("/admin/complaints");
  await admin.getByRole("link", { name: ticket }).click();
  await admin.getByRole("button", { name: "Klaim tiket" }).click();
  await expect(admin.getByText("Tiket berhasil diklaim.")).toBeVisible();
  await admin.getByRole("button", { name: "Nyatakan penanganan selesai" }).click();
  await expect(admin.getByText(/menunggu konfirmasi pelapor/)).toBeVisible();

  // pelapor mengonfirmasi
  await p2.reload();
  await expect(p2.getByRole("heading", { name: "Apakah masalah Anda sudah selesai?" })).toBeVisible();
  await p2.getByRole("button", { name: "Ya, sudah selesai" }).click();
  await expect(p2.getByText("Ditutup").first()).toBeVisible();
  await expect(p2.getByText("Dikonfirmasi selesai oleh pelapor")).toBeVisible();
  await ctx.close();
});
