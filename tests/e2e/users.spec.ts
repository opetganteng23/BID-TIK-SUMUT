import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
}

test("pengguna: tambah, cari, urutkan, ubah, reset password, nonaktifkan, hapus", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/users");
  const stamp = Date.now();
  const email = `uji-${stamp}@example.test`;

  await page.getByRole("button", { name: "Tambah pengguna" }).click();
  await page.getByLabel("Nama", { exact: true }).fill(`Uji ${stamp}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("#u-role").selectOption("editor");
  await page.getByLabel("Password awal").fill("PasswordSementara-1");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Pengguna dibuat/)).toBeVisible();

  // cari
  await page.getByLabel("Cari nama atau email").fill(`uji-${stamp}`);
  const row = page.getByRole("row", { name: new RegExp(email) });
  await expect(row).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2); // header + satu hasil

  // filter peran: Admin tidak mengandung baris ini
  await page.locator("#u-f-role").selectOption("admin");
  await expect(page.getByText("Tidak ada pengguna yang cocok")).toBeVisible();
  await page.getByRole("button", { name: "Reset filter dan urutan" }).click();
  await page.getByLabel("Cari nama atau email").fill(`uji-${stamp}`);
  await expect(row).toBeVisible();

  // urutkan: header Email berpindah menaik lalu menurun
  const emailTh = page.getByRole("columnheader", { name: /Email/ });
  await emailTh.getByRole("button").click();
  await expect(emailTh).toHaveAttribute("aria-sort", "ascending");
  await emailTh.getByRole("button").click();
  await expect(emailTh).toHaveAttribute("aria-sort", "descending");

  // ubah peran
  await row.getByRole("button", { name: /^Ubah/ }).click();
  await page.locator("#u-role").selectOption("admin");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Pengguna diperbarui/)).toBeVisible();
  await expect(row).toContainText("Admin");

  // reset password (minimal 12 karakter)
  await row.getByRole("button", { name: /Reset password/ }).click();
  await page.getByLabel("Password sementara baru").fill("PasswordReset-12345");
  await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(/Password direset/)).toBeVisible();

  // nonaktifkan lalu hapus
  await row.getByRole("button", { name: /^Nonaktifkan/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nonaktifkan" }).click();
  await expect(row).toContainText("Nonaktif");
  await row.getByRole("button", { name: /^Hapus/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByText("Pengguna dihapus.")).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("pengguna: akun sendiri tidak dapat dihapus atau dinonaktifkan dari tabel", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/users");
  await page.getByLabel("Cari nama atau email").fill(E2E_EMAIL);
  const row = page.getByRole("row", { name: new RegExp(E2E_EMAIL) });
  await expect(row.getByRole("button", { name: /^Hapus/ })).toBeDisabled();
  await expect(row.getByRole("button", { name: /^Nonaktifkan/ })).toBeDisabled();
});

test("tabel konten: pencarian dan urutan pada Halaman dan Hero", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/hero");
  await page.getByLabel("Cari slide").fill("kedua");
  await expect(page.getByRole("row", { name: /Slide contoh kedua/ }).first()).toBeVisible();
  await page.getByLabel("Cari slide").fill("");
  const th = page.getByRole("columnheader", { name: /Judul/ });
  await th.getByRole("button").click();
  await expect(th).toHaveAttribute("aria-sort", "ascending");
  await page.goto("/admin/messages");
  await expect(page.getByRole("columnheader", { name: /Diterima/ })).toHaveAttribute("aria-sort", "descending");
});
