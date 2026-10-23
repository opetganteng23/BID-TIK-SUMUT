/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

// Logo bawaan lembaga. Dipakai selama logo belum diatur di Site Settings.
const DEFAULT_LOGOS = [
  { src: "/brand/lambang-polda-sumut.png", w: 143, h: 192 },
  { src: "/brand/tik-polri.png", w: 173, h: 192 },
];

/** Logo dari Site Settings bila ada, jika tidak memakai logo bawaan. Nama situs selalu tampil sebagai teks. */
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
      ) : (
        <span className="flex items-center gap-2">
          {DEFAULT_LOGOS.map((l) => (
            <img key={l.src} src={l.src} alt="" width={l.w} height={l.h} className="h-9 w-auto" />
          ))}
        </span>
      )}
      <span className="text-base font-semibold leading-tight tracking-tight">{name}</span>
    </Link>
  );
}
