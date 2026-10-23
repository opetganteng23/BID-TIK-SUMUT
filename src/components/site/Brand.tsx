/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/** Logo dari Site Settings. Selama logo belum diunggah, tampilkan nama situs sebagai teks. */
export function Brand({ name, logoLight, logoDark }: { name: string; logoLight?: string; logoDark?: string }) {
  const light = logoLight || logoDark;
  const dark = logoDark || logoLight;
  return (
    <Link href="/" className="flex min-h-11 items-center gap-3 rounded-full pr-2" aria-label={`${name}, ke beranda`}>
      {light ? (
        <>
          <img src={light} alt="" className="h-9 w-auto dark:hidden" />
          <img src={dark} alt="" className="hidden h-9 w-auto dark:block" />
        </>
      ) : null}
      <span className="text-base font-semibold leading-tight tracking-tight">{name}</span>
    </Link>
  );
}
