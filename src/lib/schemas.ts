import { z } from "zod";

/** Tautan internal ("/..."), https, mailto, atau tel. Menolak javascript: dan data:. */
export const linkUrl = z
  .string()
  .max(500)
  .refine(
    (v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v) || /^(mailto|tel):/i.test(v),
    "Tautan harus berupa path internal, https, mailto, atau tel.",
  );

export const httpsUrl = z.string().max(1000).regex(/^https:\/\//i, "URL harus memakai https.");

/** Gambar yang diunggah disimpan sebagai base64 di database dan dilayani dari /media/<id>. */
export const mediaPath = z.string().regex(/^\/media\/[a-f\d]{24}$/i, "Path media tidak valid.");
export const imageUrl = z.union([httpsUrl, mediaPath]);
export const optionalHttpsUrl = z.union([httpsUrl, mediaPath, z.literal("")]).optional();

export const embedUrl = z
  .string()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      if (u.protocol !== "https:") return false;
      if (u.host === "www.youtube.com") return u.pathname.startsWith("/embed/");
      return ["www.youtube-nocookie.com", "player.vimeo.com"].includes(u.host);
    } catch {
      return false;
    }
  }, "Embed hanya dari YouTube atau Vimeo.");

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "ID tidak valid.");
export const slugField = z.string().max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya huruf kecil, angka, dan tanda hubung.");

export const seoSchema = z
  .object({
    title: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
    ogImage: optionalHttpsUrl,
  })
  .strict();

export const heroSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi.").max(160),
  description: z.string().max(400).optional(),
  mediaType: z.enum(["image", "video", "embed"]),
  image: optionalHttpsUrl,
  videoUrl: optionalHttpsUrl,
  embedUrl: z.union([embedUrl, z.literal("")]).optional(),
  poster: optionalHttpsUrl,
  alt: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
  ctas: z
    .array(z.object({ label: z.string().min(1).max(40), href: linkUrl, style: z.enum(["primary", "secondary"]) }).strict())
    .max(2)
    .optional(),
});

export const featureCategorySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(80),
  slug: slugField.optional(),
  order: z.number().int().min(0).max(10_000).optional(),
});

export const newsCategorySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(80),
  slug: slugField.optional(),
});

export const featureSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi.").max(160),
  slug: slugField.optional(),
  summary: z.string().max(300).optional(),
  icon: z.string().regex(/^[A-Z][A-Za-z0-9]{1,40}$/, "Nama ikon lucide tidak valid.").optional(),
  category: objectIdString.optional(),
  order: z.number().int().min(0).max(10_000).optional(),
  enabled: z.boolean().optional(),
  heroImage: optionalHttpsUrl,
  heroAlt: z.string().max(200).optional(),
  contentMode: z.enum(["richtext", "html"]).optional(),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(500_000).optional(),
  gallery: z.array(z.object({ url: imageUrl, alt: z.string().max(200) }).strict()).max(30).optional(),
  highlights: z.array(z.string().max(200)).max(20).optional(),
  cta: z.object({ label: z.string().max(40), href: linkUrl }).strict().optional(),
  seo: seoSchema.optional(),
});

export const pageSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi.").max(160),
  slug: slugField.optional(),
  contentMode: z.enum(["richtext", "html"]).optional(),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(500_000).optional(),
  enabled: z.boolean().optional(),
  seo: seoSchema.optional(),
});

export const complaintCategorySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(80),
  slug: slugField.optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
});

export const newsSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi.").max(200),
  slug: slugField.optional(),
  excerpt: z.string().max(400).optional(),
  coverImage: optionalHttpsUrl,
  coverAlt: z.string().max(200).optional(),
  media: z
    .array(
      z
        .object({
          type: z.enum(["image", "video", "embed"]),
          url: z.string().max(1000),
          alt: z.string().max(200).optional(),
          caption: z.string().max(300).optional(),
        })
        .strict(),
    )
    .max(30)
    .optional(),
  contentMode: z.enum(["richtext", "html", "html_raw"]).optional(),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(500_000).optional(),
  rawHtml: z.string().max(500_000).optional(),
  category: objectIdString.optional().or(z.literal("")),
  tags: z.array(z.string().max(40)).max(15).optional(),
  publishedAt: z.coerce.date().optional(),
  seo: seoSchema.optional(),
});

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Nama wajib diisi.").max(100),
    email: z.string().trim().email("Email tidak valid.").max(200),
    phone: z.string().trim().max(30).optional(),
    subject: z.string().trim().min(3, "Subjek wajib diisi.").max(150),
    message: z.string().trim().min(10, "Pesan terlalu pendek.").max(3000),
    website: z.string().max(200).optional(), // honeypot: diperiksa di route, terisi berarti bot
  })
  .strict();
