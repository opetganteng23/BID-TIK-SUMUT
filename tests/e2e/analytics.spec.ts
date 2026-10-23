import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

// Membutuhkan data DEMO: pnpm seed:demo-pengaduan -- --count 220 pada database uji.
const ORIGIN = process.env.BASE_URL ?? "http://localhost:3200";

async function loginPage(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
}

async function json(req: APIRequestContext, path: string) {
  const res = await req.get(path);
  return { status: res.status(), body: res.status() === 200 && /json/.test(res.headers()["content-type"] ?? "") ? await res.json() : null };
}

test.describe("API analitik dan laporan", () => {
  test("analitik: struktur, konsistensi angka, dan filter", async ({ page }) => {
    await loginPage(page);
    const all = await json(page.request, "/api/admin/complaints/analytics?from=2020-01-01T00:00:00.000Z");
    expect(all.status).toBe(200);
    const a = all.body.data;
    expect(a.kpi.total).toBeGreaterThan(100);
    expect(a.byStatus.reduce((n: number, s: { count: number }) => n + s.count, 0)).toBe(a.kpi.total);
    expect(a.byCategory.reduce((n: number, c: { count: number }) => n + c.count, 0)).toBe(a.kpi.total);
    expect(a.byRegion.reduce((n: number, r: { count: number }) => n + r.count, 0) + a.unknownRegion).toBe(a.kpi.total);
    expect(a.trend.reduce((n: number, t: { created: number }) => n + t.created, 0)).toBe(a.kpi.total);
    expect(a.hour.reduce((n: number, h: { count: number }) => n + h.count, 0)).toBe(a.kpi.total);
    expect(a.insights.length).toBeGreaterThan(3);
    expect(a.kpi.avgFirstResponseHrs).toBeGreaterThan(0);
    // aman: tidak ada data pribadi pelapor di JSON
    expect(JSON.stringify(a)).not.toMatch(/Warga Fiktif|081200000000|Alamat fiktif/);

    const medan = (await json(page.request, "/api/admin/complaints/analytics?from=2020-01-01T00:00:00.000Z&region=medan")).body.data;
    expect(medan.byRegion.map((r: { slug: string }) => r.slug)).toEqual(["medan"]);
    expect(medan.kpi.total).toBe(a.byRegion.find((r: { slug: string }) => r.slug === "medan").count);

    const cat = a.byCategory[0];
    const byCat = (await json(page.request, `/api/admin/complaints/analytics?from=2020-01-01T00:00:00.000Z&categoryId=${cat.id}`)).body.data;
    expect(byCat.kpi.total).toBe(cat.count);

    const closed = (await json(page.request, "/api/admin/complaints/analytics?from=2020-01-01T00:00:00.000Z&status=closed")).body.data;
    expect(closed.kpi.total).toBe(a.kpi.closed);

    const narrow = (await json(page.request, `/api/admin/complaints/analytics?from=${new Date(Date.now() - 7 * 86400000).toISOString()}`)).body.data;
    expect(narrow.kpi.total).toBeLessThan(a.kpi.total);
    expect(narrow.period.granularity).toBe("day");
    // "Semua waktu" (batas awal 2020) dijepit ke pengaduan pertama, bukan bertahun-tahun tanpa data.
    const long = (await json(page.request, "/api/admin/complaints/analytics?from=2020-01-01T00:00:00.000Z")).body.data;
    expect(new Date(long.period.from).getUTCFullYear()).toBeGreaterThanOrEqual(2026);
    expect(long.period.days).toBeLessThan(120);
    expect(long.kpi.previousTotal).toBeNull();
    expect(long.insights.join(" ")).not.toMatch(/dibanding periode sebelumnya/);
  });

  test("izin: tamu 401, parameter liar 400, editor boleh analitik tetapi tidak boleh ekspor", async ({ page, playwright }) => {
    await loginPage(page);
    const anon = await playwright.request.newContext({ baseURL: ORIGIN });
    expect((await anon.get("/api/admin/complaints/analytics")).status()).toBe(401);
    expect((await anon.get("/api/admin/complaints/report/xlsx")).status()).toBe(401);
    expect((await page.request.get("/api/admin/complaints/analytics?region=../../etc")).status()).toBe(400);
    expect((await page.request.get("/api/admin/complaints/analytics?categoryId=bukan-id")).status()).toBe(400);
    expect((await page.request.get("/api/admin/complaints/analytics?status=hack")).status()).toBe(400);

    const email = `editor-an-${Date.now()}@example.test`;
    const mk = await page.request.post("/api/admin/users", { data: { name: "Editor Analitik", email, role: "editor", password: "PasswordSementara-1" }, headers: { origin: ORIGIN } });
    expect(mk.status()).toBe(201);
    // editor wajib ganti password dulu; masuk lewat DB tidak tersedia di sini, jadi cukup uji lewat UI login lalu ganti password.
    const ed = await playwright.request.newContext({ baseURL: ORIGIN, extraHTTPHeaders: { origin: ORIGIN } });
    expect((await ed.post("/api/auth/login", { data: { email, password: "PasswordSementara-1" } })).status()).toBe(200);
    expect((await ed.post("/api/auth/change-password", { data: { currentPassword: "PasswordSementara-1", newPassword: "PasswordBaruEditor-12345" } })).status()).toBe(200);
    expect((await ed.get("/api/admin/complaints/analytics")).status()).toBe(200);
    expect((await ed.get("/api/admin/complaints/report/xlsx")).status()).toBe(403);
    expect((await ed.get("/api/admin/complaints/report/pptx")).status()).toBe(403);
  });

  test("Excel: lembar lengkap, angka sama dengan API, dan tanpa data pribadi", async ({ page }) => {
    await loginPage(page);
    const qs = "from=2020-01-01T00:00:00.000Z";
    const api = (await json(page.request, `/api/admin/complaints/analytics?${qs}`)).body.data;
    const res = await page.request.get(`/api/admin/complaints/report/xlsx?${qs}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="analitik-pengaduan-\d{4}-\d{2}-\d{2}\.xlsx"/);
    const buf = await res.body();
    expect(buf.subarray(0, 2).toString()).toBe("PK");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const names = wb.worksheets.map((w) => w.name);
    for (const n of ["Ringkasan", "Data Pengaduan", "Per Kategori", "Per Wilayah", "Per Status", "Per Hari", "Per Petugas", "Pola Waktu", "Wilayah x Kategori", "Umur Tiket Terbuka"]) expect(names).toContain(n);

    const sum = wb.getWorksheet("Ringkasan")!;
    const item = (label: string) => { let v: unknown; sum.eachRow((r) => { if (r.getCell(1).value === label) v = r.getCell(2).value; }); return v; };
    expect(item("Total pengaduan")).toBe(api.kpi.total);
    expect(item("Sudah ditutup")).toBe(api.kpi.closed);
    expect(item("Masih terbuka")).toBe(api.kpi.open);
    expect(String(item("Satuan kerja"))).toContain("Bid TIK Polda Sumatera Utara");

    const data = wb.getWorksheet("Data Pengaduan")!;
    expect(data.rowCount - 1).toBe(api.kpi.total);
    expect(data.getRow(1).values).toEqual(expect.arrayContaining(["Nomor Tiket", "Kategori", "Wilayah", "Status"]));
    const reg = wb.getWorksheet("Per Wilayah")!;
    let regSum = 0;
    reg.eachRow((r, i) => { if (i > 1) regSum += Number(r.getCell(2).value) || 0; });
    expect(regSum).toBe(api.kpi.total);

    // tidak ada data pribadi di seluruh buku kerja
    let all = "";
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => { all += `${c.value} `; })));
    expect(all).not.toMatch(/Warga Fiktif|081200000000|Alamat fiktif/);
  });

  test("PPTX: ringkasan eksekutif valid dengan grafik native dan tanpa data pribadi", async ({ page }) => {
    await loginPage(page);
    const qs = "from=2020-01-01T00:00:00.000Z";
    const api = (await json(page.request, `/api/admin/complaints/analytics?${qs}`)).body.data;
    const res = await page.request.get(`/api/admin/complaints/report/pptx?${qs}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("presentationml");
    const zip = await JSZip.loadAsync(await res.body());
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    const charts = Object.keys(zip.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f));
    expect(slides.length).toBe(13);
    expect(charts.length).toBe(6); // tren, status, kategori, hari, jam, umur tiket
    let text = "";
    for (const f of slides) text += (await zip.files[f].async("string")).replace(/<[^>]+>/g, " ");
    expect(text).toContain("Analitik Pengaduan Masyarakat");
    expect(text).toContain("Ringkasan eksekutif");
    expect(text).toContain("Rekomendasi tindak lanjut");
    expect(text).toContain("Sebaran wilayah");
    expect(text).toContain(String(api.kpi.total).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    expect(text).not.toMatch(/Warga Fiktif|081200000000|Alamat fiktif/);
    const presentation = await zip.files["ppt/presentation.xml"].async("string");
    expect(presentation).toMatch(/sldSz cx="12192000" cy="6858000"/); // 16:9
    expect(Object.keys(zip.files).some((f) => /^ppt\/media\/.*\.png$/.test(f))).toBe(true); // logo
  });

  test("PPTX dan Excel tetap dapat dibuat saat tidak ada data", async ({ page }) => {
    await loginPage(page);
    const none = "from=2019-01-01T00:00:00.000Z&to=2019-01-31T00:00:00.000Z";
    const p = await page.request.get(`/api/admin/complaints/report/pptx?${none}`);
    expect(p.status()).toBe(200);
    const zip = await JSZip.loadAsync(await p.body());
    expect(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length).toBe(2);
    const x = await page.request.get(`/api/admin/complaints/report/xlsx?${none}`);
    expect(x.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await x.body()) as never);
    expect(wb.getWorksheet("Data Pengaduan")!.rowCount).toBe(1);
  });

  test("unduhan laporan tercatat di audit log", async ({ page }) => {
    await loginPage(page);
    await page.request.get("/api/admin/complaints/report/pptx?from=2020-01-01T00:00:00.000Z");
    const audit = await json(page.request, "/api/admin/audit?action=complaint.report");
    expect(audit.body.data.items.some((i: { action: string }) => i.action === "complaint.report_pptx")).toBe(true);
    expect(JSON.stringify(audit.body)).not.toMatch(/Warga Fiktif|081200000000/);
  });
});

test.describe("Dashboard analitik (UI)", () => {
  test("memuat KPI, grafik, peta, temuan, dan tabel; lolos axe terang dan gelap", async ({ page }) => {
    await loginPage(page);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => localStorage.setItem("a11y", JSON.stringify({ theme: t })), theme);
      await page.goto("/admin/complaints/analytics");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Analitik Pengaduan", level: 1 })).toBeVisible();
      await expect(page.getByText("Total pengaduan", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Temuan utama" })).toBeVisible();
      await expect(page.getByRole("img", { name: /Grafik tren pengaduan/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pengaduan per kategori" })).toBeVisible();
      // peta Leaflet dengan lingkaran wilayah
      const map = page.getByRole("img", { name: /Peta sebaran pengaduan/ });
      await expect(map).toBeVisible();
      await expect(page.locator(".leaflet-container")).toBeVisible();
      await expect.poll(() => page.locator("path.leaflet-interactive").count(), { timeout: 15000 }).toBeGreaterThan(3);
      await page.screenshot({ path: `tests/e2e/__shots__/analytics-${theme}.png`, fullPage: true });
      const v = (await new AxeBuilder({ page }).exclude(".leaflet-container").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()).violations.map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(v, theme).toEqual([]);
    }
  });

  test("filter wilayah dan kategori memperbarui angka", async ({ page }) => {
    await loginPage(page);
    await page.goto("/admin/complaints/analytics");
    const total = page.locator("section[aria-label='Indikator utama'] > div").first().locator("p").nth(1);
    await expect(total).not.toHaveText("0");
    const before = await total.innerText();
    await page.locator("#an-region").selectOption("medan");
    await expect.poll(async () => total.innerText()).not.toBe(before);
    await page.locator("#an-preset").selectOption("all");
    await page.getByRole("button", { name: "Reset filter" }).click();
    await expect(page.locator("#an-region")).toHaveValue("");
  });

  test("tombol unduh Excel dan PPTX menghasilkan berkas", async ({ page }) => {
    await loginPage(page);
    await page.goto("/admin/complaints/analytics");
    const [x] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh Excel" }).click()]);
    expect(x.suggestedFilename()).toMatch(/\.xlsx$/);
    const [p] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Ringkasan Eksekutif/ }).click()]);
    expect(p.suggestedFilename()).toMatch(/\.pptx$/);
  });

  test("padanan tabel tersedia untuk grafik (aksesibilitas)", async ({ page }) => {
    await loginPage(page);
    await page.goto("/admin/complaints/analytics");
    const first = page.getByText("Lihat sebagai tabel").first();
    await first.click();
    await expect(page.getByRole("table", { name: "Tren pengaduan" })).toBeVisible();
  });

  test("responsif: tanpa scroll horizontal di berbagai ukuran layar", async ({ page }) => {
    await loginPage(page);
    for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1920, 1080], [3440, 1440], [1080, 1920]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/admin/complaints/analytics");
      await expect(page.getByRole("heading", { name: "Temuan utama" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `@${w}x${h}`).toBeLessThanOrEqual(0);
    }
  });

  test("halaman daftar pengaduan menampilkan kolom wilayah dan tautan analitik", async ({ page }) => {
    await loginPage(page);
    await page.goto("/admin/complaints");
    await expect(page.getByRole("columnheader", { name: "Wilayah" })).toBeVisible();
    await page.getByRole("link", { name: /Analitik dan laporan/ }).click();
    await expect(page).toHaveURL(/\/admin\/complaints\/analytics/);
  });
});
