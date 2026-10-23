export type MediaKind = "image" | "video" | "logo";

export const MEDIA_RULES: Record<MediaKind, { mimes: string[]; maxBytes: number }> = {
  image: { mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"], maxBytes: 5 * 1024 * 1024 },
  logo: { mimes: ["image/png", "image/webp"], maxBytes: 1 * 1024 * 1024 },
  video: { mimes: ["video/mp4"], maxBytes: 50 * 1024 * 1024 },
};

/** Signature (magic bytes) per MIME. Tidak percaya Content-Type dari browser. */
export function matchesSignature(mime: string, b: Uint8Array): boolean {
  const eq = (offset: number, bytes: number[]) => bytes.every((v, i) => b[offset + i] === v);
  switch (mime) {
    case "image/jpeg":
      return eq(0, [0xff, 0xd8, 0xff]);
    case "image/png":
      return eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50]);
    case "image/avif":
      return eq(4, [0x66, 0x74, 0x79, 0x70]) && (eq(8, [0x61, 0x76, 0x69, 0x66]) || eq(8, [0x61, 0x76, 0x69, 0x73]));
    case "video/mp4":
      return eq(4, [0x66, 0x74, 0x79, 0x70]);
    case "application/pdf":
      return eq(0, [0x25, 0x50, 0x44, 0x46]);
    default:
      return false;
  }
}

export function mediaTypeOf(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export const MEDIA_PATH = /^\/media\/([a-f\d]{24})$/i;
export const isMediaPath = (u: string) => MEDIA_PATH.test(u);

export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
