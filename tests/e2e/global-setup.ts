/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDb } from "@/lib/db";
import { ComplaintCategory, RateLimit, User } from "@/lib/models";
import { hashPassword } from "@/lib/auth/password";

export const E2E_PASSWORD = "PasswordE2E-12345";
export const E2E_EMAIL = "e2e-super@example.test";

/** Menyiapkan pengguna dan konten contoh lewat API admin agar uji memakai jalur sebenarnya. */
export default async function globalSetup() {
  const base = process.env.BASE_URL ?? "http://localhost:3100";
  await connectDb();
  // Batas laju sengaja ketat di server (mis. 5 kontak/IP/jam); counter dibersihkan agar uji dapat diulang.
  await RateLimit.deleteMany({});
  await User.deleteOne({ email: E2E_EMAIL });
  await User.create({ name: "Super E2E", email: E2E_EMAIL, role: "super_admin", passwordHash: await hashPassword(E2E_PASSWORD), mustChangePassword: false });
  if (!(await ComplaintCategory.countDocuments())) {
    await ComplaintCategory.create({ name: "Pelayanan", slug: "pelayanan", order: 0, active: true });
  }

  const jar: string[] = [];
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", origin: base, cookie: jar.join("; ") },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) jar.push(c.split(";")[0]);
    const json = (await res.json()) as { ok: boolean; data?: any; error?: any };
    if (!json.ok) throw new Error(`${method} ${path} gagal: ${JSON.stringify(json.error)}`);
    return json.data;
  };

  await call("POST", "/api/auth/login", { email: E2E_EMAIL, password: E2E_PASSWORD });
  await call("PUT", "/api/admin/settings", {
    siteName: "BID TIK Polda Sumatera Utara",
    tagline: "Contoh tagline (data uji)",
    orgName: "BID TIK Polda Sumatera Utara",
    footer: {
      about: "Informasi lembaga contoh untuk pengujian.",
      address: "Alamat contoh, Medan",
      phones: ["061 000 0000"],
      emails: ["kontak@example.test"],
      hours: "Senin sampai Jumat, 08.00 sampai 16.00 WIB",
      quickLinks: [{ label: "Berita", href: "/berita" }],
      socials: [],
      copyright: "Hak cipta contoh",
    },
    marquees: [
      { id: "m1", after: "hero", enabled: true, speed: 40, direction: "left", height: 56, items: [{ type: "text", text: "Informasi contoh pertama" }, { type: "text", text: "Informasi contoh kedua" }] },
    ],
  });
  await call("PUT", "/api/admin/about", { title: "Tentang Kami", body: "<p>Teks tentang contoh untuk pengujian.</p>", stats: [{ value: "24/7", label: "Layanan" }] });
  await call("POST", "/api/admin/hero", { title: "Slide contoh pertama", description: "Deskripsi slide contoh.", mediaType: "image", enabled: true, ctas: [{ label: "Lihat berita", href: "/berita", style: "primary" }] }).catch(() => {});
  await call("POST", "/api/admin/hero", { title: "Slide contoh kedua", mediaType: "image", enabled: true }).catch(() => {});
  const fcat = await call("POST", "/api/admin/feature-categories", { name: `Kategori Uji ${Date.now()}` });
  await call("POST", "/api/admin/features", { title: `Fitur Uji ${Date.now()}`, summary: "Ringkasan fitur uji.", icon: "ShieldCheck", category: fcat._id, contentMode: "html", contentHtml: "<p>Isi fitur uji.</p>", highlights: ["Poin satu", "Poin dua"] });
  const n = await call("POST", "/api/admin/news", { title: `Berita Uji E2E ${Date.now()}`, excerpt: "Ringkasan berita uji.", contentMode: "html", contentHtml: "<h2>Subjudul</h2><p>Paragraf pertama berita uji.</p><p>Paragraf kedua.</p>" });
  await call("POST", `/api/admin/news/${n._id}/publish`, {});
}
