import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Wajib: loader Tailwind v4 untuk Turbopack (tanpa ini kelas utilitas tidak dihasilkan).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async redirects() {
    // Alamat lama /fitur berganti menjadi /layanan.
    return [
      { source: "/fitur", destination: "/layanan", permanent: true },
      { source: "/fitur/:slug", destination: "/layanan/:slug", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // X-Frame-Options DENY kecuali halaman HTML mentah yang dibingkai oleh situs sendiri.
      { source: "/((?!embed).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/embed/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
