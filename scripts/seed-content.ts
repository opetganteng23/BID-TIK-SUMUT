/**
 * Mengisi konten awal agar situs baru tidak kosong: hero, berita, running text, dan beberapa pengaturan.
 * Idempoten: tidak menimpa konten yang sudah diisi admin. Jalankan setelah `pnpm seed`.
 *
 * Berita bersumber dari data scripts/data/berita-bidtik.json (judul, paragraf pembuka, dan tautan ke artikel
 * asli di situs BID TIK Polda Sumut sebelumnya; tanggal bertanda dateGuessed adalah perkiraan).
 */
import fs from "node:fs";
import { connectDb } from "@/lib/db";
import { HeroSlide, News, NewsCategory, SiteSettings, User } from "@/lib/models";
import { sanitizeContent } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";

type Berita = { title: string; lead: string; url: string; date: string; dateGuessed?: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ABOUT =
  "Bidang Teknologi Informasi dan Komunikasi yang selanjutnya disebut Bid TIK adalah unsur pengawas dan pembantu pimpinan dalam bidang teknologi informasi dan komunikasi pada tingkat Polda yang berada di bawah Kapolda.";

const RUNNING_TEXT = [
  "Bid TIK Polda Sumut",
  "Call Center 110: layanan darurat Polri",
  "Melayani dengan teknologi",
  "Polri Presisi: prediktif, responsibilitas, transparansi berkeadilan",
  "Layanan pengaduan online tersedia",
  "Dukungan perangkat TIK untuk pengamanan dan pelayanan",
];

async function main() {
  await connectDb();
  const author = await User.findOne({ role: "super_admin", isActive: true }).sort({ createdAt: 1 });
  if (!author) throw new Error("Belum ada Super Admin. Jalankan pnpm seed terlebih dahulu.");

  // ---- Hero ----
  if (!(await HeroSlide.exists({ title: "Bidang TIK" }))) {
    const next = ((await HeroSlide.findOne().sort({ order: -1 }).lean())?.order ?? -1) + 1;
    await HeroSlide.create({
      title: "Bidang TIK",
      subtitle: "Polda Sumatera Utara",
      description: ABOUT,
      mediaType: "image",
      enabled: true,
      order: next,
      ctas: [
        { label: "Lihat berita", href: "/berita", style: "primary" },
        { label: "Ajukan pengaduan", href: "/pengaduan", style: "secondary" },
      ],
    });
    console.log("+ hero: Bidang TIK");
  }

  // ---- Pengaturan: tidak menimpa isian admin ----
  const s = await SiteSettings.findOne({ key: "singleton" });
  if (s) {
    if (s.newsHomeCount === 6) s.newsHomeCount = 9; // slider memuat lebih banyak
    if (!s.tagline) s.tagline = "Bidang Teknologi Informasi dan Komunikasi Polda Sumatera Utara";
    if (!s.orgName) s.orgName = "Bid TIK Polda Sumatera Utara";
    if (!s.footer?.about) s.set("footer.about", ABOUT);
    if (!s.marquees?.length) {
      s.marquees = [
        { id: "info-1", after: "hero", enabled: true, speed: 45, direction: "left", height: 56, items: RUNNING_TEXT.map((text) => ({ type: "text", text })) },
      ] as never;
      console.log("+ running text");
    }
    for (const m of s.menu ?? []) if (m.label === "Fitur" && m.href === "/fitur") { m.label = "Layanan"; m.href = "/layanan"; }
    for (const sec of s.sections ?? []) if (sec.key === "features" && sec.title === "Fitur") sec.title = "Layanan";
    s.markModified("menu");
    s.markModified("sections");
    await s.save();
  }

  // ---- Berita ----
  const data = JSON.parse(fs.readFileSync("scripts/data/berita-bidtik.json", "utf8")) as Berita[];
  const catName = "Berita Kegiatan";
  const cat = (await NewsCategory.findOne({ slug: slugify(catName) })) ?? (await NewsCategory.create({ name: catName, slug: slugify(catName) }));
  let created = 0;
  let skipped = 0;
  for (const it of [...data].reverse()) {
    const slug = slugify(it.title);
    if (!slug || (await News.exists({ slug }))) {
      skipped++;
      continue;
    }
    const lead = it.lead.replace(/\s+/g, " ").trim();
    await News.create({
      title: it.title,
      slug,
      excerpt: lead.slice(0, 200),
      contentMode: "html",
      contentHtml: sanitizeContent(
        `<p>${esc(lead)}</p><p>Berita selengkapnya dapat dibaca di <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">situs BID TIK Polda Sumut sebelumnya</a>.</p>`,
      ),
      category: cat._id,
      tags: ["arsip-situs-lama"],
      status: "published",
      publishedAt: new Date(it.date),
      publishedAtActual: new Date(),
      authorId: author._id,
      authorNameSnapshot: "Redaksi BID TIK",
      publishedBy: author._id,
    });
    created++;
  }
  console.log(`Berita: ${created} dibuat, ${skipped} dilewati (sudah ada).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
