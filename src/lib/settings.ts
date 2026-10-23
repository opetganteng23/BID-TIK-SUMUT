import { unstable_cache, revalidateTag } from "next/cache";
import { connectDb } from "@/lib/db";
import { SiteSettings } from "@/lib/models";

export const DEFAULT_SECTIONS = [
  { key: "hero", enabled: true, order: 0, title: "", subtitle: "" },
  { key: "about", enabled: true, order: 1, title: "Tentang Kami", subtitle: "" },
  { key: "news", enabled: true, order: 2, title: "Berita Terbaru", subtitle: "" },
  { key: "features", enabled: true, order: 3, title: "Fitur", subtitle: "" },
] as const;

export const DEFAULT_MENU = [
  { label: "Beranda", href: "/", enabled: true, openInNewTab: false, children: [] },
  { label: "Berita", href: "/berita", enabled: true, openInNewTab: false, children: [] },
  { label: "Fitur", href: "/fitur", enabled: true, openInNewTab: false, children: [] },
  { label: "Pengaduan", href: "/pengaduan", enabled: true, openInNewTab: false, children: [] },
  { label: "Kontak", href: "/kontak", enabled: true, openInNewTab: false, children: [] },
];

export type PublicSettings = {
  siteName: string;
  tagline: string;
  orgName: string;
  logoLight?: string;
  logoDark?: string;
  favicon?: string;
  menu: { label: string; href: string; openInNewTab: boolean; enabled: boolean; children: { label: string; href: string; openInNewTab: boolean; enabled: boolean }[] }[];
  sections: { key: "hero" | "about" | "news" | "features"; enabled: boolean; order: number; title: string; subtitle: string }[];
  newsHomeCount: number;
  newsHomeCategory?: string;
  marquees: { id: string; after: string; enabled: boolean; speed: number; direction: "left" | "right"; height: number; items: { type: "text" | "logo"; text?: string; logo?: string; alt?: string; href?: string }[] }[];
  footer: { about?: string; address?: string; phones: string[]; emails: string[]; hours?: string; mapEmbedUrl?: string; quickLinks: { label: string; href: string }[]; socials: { label: string; href: string }[]; copyright?: string };
  seo: { defaultTitle?: string; titleTemplate: string; defaultDescription?: string; ogImage?: string; robotsIndex: boolean };
  accessibility: { defaultTheme: "light" | "dark" | "system"; defaultFontScale: number; ttsEnabled: boolean; ttsDefaultLang: string };
  maintenanceMode: boolean;
  maintenanceMessage?: string;
};

/** Pengaturan yang aman untuk publik (tanpa penerima email atau flag OTP). */
export const getPublicSettings = unstable_cache(
  async (): Promise<PublicSettings> => {
    await connectDb();
    const doc = (await SiteSettings.findOne({ key: "singleton" }).lean()) ?? {};
    const s = JSON.parse(JSON.stringify(doc)) as Partial<PublicSettings>;
    return {
      siteName: s.siteName ?? "BID TIK Polda Sumatera Utara",
      tagline: s.tagline ?? "",
      orgName: s.orgName ?? "",
      logoLight: s.logoLight,
      logoDark: s.logoDark,
      favicon: s.favicon,
      menu: s.menu?.length ? s.menu : (DEFAULT_MENU as PublicSettings["menu"]),
      sections: (s.sections?.length ? s.sections : [...DEFAULT_SECTIONS]).slice().sort((a, b) => a.order - b.order),
      newsHomeCount: s.newsHomeCount ?? 6,
      newsHomeCategory: s.newsHomeCategory,
      marquees: s.marquees ?? [],
      footer: { phones: [], emails: [], quickLinks: [], socials: [], ...(s.footer ?? {}) },
      seo: { titleTemplate: "%s | BID TIK Polda Sumut", robotsIndex: false, ...(s.seo ?? {}) },
      accessibility: { defaultTheme: "system", defaultFontScale: 1, ttsEnabled: true, ttsDefaultLang: "id-ID", ...(s.accessibility ?? {}) },
      maintenanceMode: s.maintenanceMode ?? false,
      maintenanceMessage: s.maintenanceMessage,
    };
  },
  ["public-settings"],
  { tags: ["settings"] },
);

/** Invalidasi langsung (blocking) agar perubahan admin tampil segera. */
export function revalidate(...tags: string[]) {
  for (const t of tags) revalidateTag(t, { expire: 0 });
}
