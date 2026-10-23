import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "bid_session";
const OPEN_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self' https://*.vercel-storage.com https://vercel.com",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.google.com/maps/",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Gerbang awal /admin (hanya cek keberadaan cookie, otorisasi sebenarnya ada di server)
 * dan CSP berbasis nonce. Route handler tetap memverifikasi sesi, peran, dan input sendiri.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !OPEN_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!request.cookies.get(SESSION_COOKIE)) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Halaman HTML mentah memakai CSP-nya sendiri dari route handler.
  if (pathname.startsWith("/embed/")) return NextResponse.next();

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|brand/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
