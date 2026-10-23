"use client";

export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <main id="konten" className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl">Terjadi kesalahan</h1>
      <p className="max-w-md text-muted">Halaman tidak dapat dimuat saat ini. Silakan coba lagi.</p>
      <button type="button" onClick={() => unstable_retry()} className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-fg">
        Coba lagi
      </button>
    </main>
  );
}
