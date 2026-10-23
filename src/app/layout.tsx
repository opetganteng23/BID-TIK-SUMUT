import type { Metadata } from "next";
import { headers } from "next/headers";
import { Poppins, Atkinson_Hyperlegible } from "next/font/google";
import { getPublicSettings } from "@/lib/settings";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

async function safeSettings() {
  try {
    return await getPublicSettings();
  } catch {
    return null; // database belum dikonfigurasi: pakai default bawaan
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await safeSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: s?.seo.defaultTitle || s?.siteName || "BID TIK Polda Sumatera Utara", template: s?.seo.titleTemplate || "%s | BID TIK Polda Sumut" },
    description: s?.seo.defaultDescription || "Website resmi BID TIK Polda Sumatera Utara (prototype).",
    robots: s?.seo.robotsIndex ? { index: true, follow: true } : { index: false, follow: false },
    icons: s?.favicon ? { icon: s.favicon } : undefined,
    openGraph: { type: "website", locale: "id_ID", images: s?.seo.ogImage ? [s.seo.ogImage] : undefined },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const s = await safeSettings();
  const defaults = JSON.stringify({
    theme: s?.accessibility.defaultTheme ?? "system",
    fontScale: s?.accessibility.defaultFontScale ?? 1,
  });

  // Terapkan preferensi sebelum render pertama agar tidak ada kilatan tema.
  const prefsScript = `(function(){try{var D=${defaults};var p={};try{p=JSON.parse(localStorage.getItem("a11y")||"{}")}catch(e){}var d=document.documentElement;var t=p.theme||D.theme;if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;if(p.contrast)d.dataset.contrast="high";if(p.reduceMotion||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.motion="reduce";if(p.dyslexia)d.dataset.font="dyslexia";if(p.spacing==="loose")d.dataset.spacing="loose";d.style.setProperty("--font-scale",String(p.fontScale||D.fontScale))}catch(e){}})();`;

  return (
    <html lang="id" suppressHydrationWarning className={`${poppins.variable} ${atkinson.variable} h-full antialiased`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#konten" className="skip-link">
          Lewati ke konten
        </a>
        {children}
      </body>
    </html>
  );
}
