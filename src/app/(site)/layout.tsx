import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui";
import { getPublicSettings } from "@/lib/settings";

// Data dibaca dari cache bertag (revalidateTag saat admin menyimpan); halaman dirender per permintaan.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getPublicSettings();

  if (settings.maintenanceMode) {
    return (
      <main id="konten" className="flex min-h-svh items-center justify-center">
        <Container className="max-w-xl text-center">
          <h1 className="text-4xl">Sedang dalam pemeliharaan</h1>
          <p className="mt-4 text-muted">{settings.maintenanceMessage || "Situs sedang dalam pemeliharaan. Silakan kembali beberapa saat lagi."}</p>
        </Container>
      </main>
    );
  }

  return (
    <>
      <Header settings={settings} />
      <main id="konten" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer settings={settings} />
    </>
  );
}
