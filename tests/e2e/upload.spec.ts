import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

const ALT = `Gambar derau ${Date.now()}`;

test("unggah gambar di Media: dikonversi base64, tersimpan, dan tampil dari /media/<id>", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
  await page.goto("/admin/media");

  // PNG derau acak 1800x1800 (>3 MB) dibuat di browser agar memicu pengecilan sisi klien.
  const bigPng = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 1800;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(1800, 1800);
    crypto.getRandomValues(img.data.subarray(0, 65536));
    for (let i = 0; i < img.data.length; i += 65536) crypto.getRandomValues(img.data.subarray(i, Math.min(i + 65536, img.data.length)));
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  expect(bigPng.length).toBeGreaterThan(3 * 1024 * 1024);

  let sent: { mime: string; base64: string } | null = null;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/admin/media/image")) sent = JSON.parse(r.postData() ?? "{}");
  });
  await page.setInputFiles("#media-file", { name: "besar.png", mimeType: "image/png", buffer: Buffer.from(bigPng) });
  await page.getByLabel("Alt text").fill(ALT);
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
  await expect(page.getByAltText(ALT, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  expect(sent).not.toBeNull();
  expect(sent!.mime).toBe("image/webp"); // diperkecil dan dikonversi
  expect(sent!.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  const src = await page.getByAltText(ALT, { exact: true }).first().getAttribute("src");
  expect(src).toMatch(/^\/media\/[a-f0-9]{24}$/);
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");
});
