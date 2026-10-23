import Link from "next/link";

export default function NotFound() {
  return (
    <main id="konten" className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-5xl">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-muted">Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-fg">
        Kembali ke beranda
      </Link>
    </main>
  );
}
