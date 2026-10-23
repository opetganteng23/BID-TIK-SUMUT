# Website BID TIK Polda Sumatera Utara (prototype)

Implementasi MTS v2.2 (`../MTS-v2.2.md`): Next.js App Router + TypeScript, Tailwind v4, MongoDB (Mongoose), Nodemailer, Vercel Blob.

**Prototype.** Hanya konten publik. Modul Pengaduan hanya boleh diuji dengan data fiktif sampai gate rilis MTS Section 29.14 disetujui.

## Mulai cepat

```bash
pnpm install
cp .env.example .env.local     # isi nilainya (lihat tabel di bawah)
pnpm seed                      # Super Admin awal, pengaturan, kategori pengaduan
pnpm dev
```

Login di `/admin/login` dengan akun dari `SEED_ADMIN_*`. Anda wajib mengganti password saat login pertama.

## Variabel environment

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ya | URL publik tanpa slash akhir |
| `MONGODB_URI`, `MONGODB_DB` | ya | Atlas, user khusus hak minimal |
| `AUTH_SECRET` | ya | min. 32 karakter acak, penandatangan sesi admin |
| `COMPLAINT_SESSION_SECRET`, `COMPLAINT_ACCESS_PEPPER` | untuk Pengaduan | min. 32 karakter, berbeda satu sama lain |
| `SEED_ADMIN_NAME/EMAIL/PASSWORD` | untuk seed | password min. 12 karakter |
| `MAIL_USER`, `MAIL_APP_PASSWORD` | untuk email | Gmail dengan App Password (mailbox khusus, 2FA aktif) |
| `BLOB_READ_WRITE_TOKEN` | untuk media | Vercel Blob |
| `CRON_SECRET` | untuk auto-close | Vercel mengirimnya sebagai `Authorization: Bearer` |
| `COMPLAINT_UPLOAD_ENABLED` | opsional | `true` hanya bila storage privat siap |

Buat rahasia acak: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Gate statis |
| `pnpm test` | Unit test (Vitest) |
| `pnpm seed` / `pnpm seed:demo` | Data awal / data contoh yang dinonaktifkan |

### Uji integrasi dan e2e

Keduanya memakai server yang berjalan dan **database uji** (jangan arahkan ke database prototype, karena membuat dan mengubah data):

```bash
pnpm build && pnpm start -p 3100            # dengan env database uji
BASE_URL=http://localhost:3100 pnpm exec tsx scripts/integration.ts
BASE_URL=http://localhost:3100 pnpm exec playwright test
```

`integration.ts` (138 pemeriksaan): auth, RBAC, alur berita, sanitasi XSS, CSRF, NoSQL injection, klaim bersamaan, auto-close, rate limit, XLSX. `playwright` (34 uji): axe terang/gelap/kontras tinggi, responsif 360 sampai 1440px, widget aksesibilitas, alur UI admin dan pengaduan. Untuk database lokal tanpa Atlas, `mongodb-memory-server` tersedia sebagai dependensi dev.

## Struktur

- `src/lib/` logika server: `http.ts` (kontrak API), `rbac.ts`, `news-state.ts`, `complaint-state.ts`, `sanitize.ts`, `crud.ts`, model di `models/`.
- `src/app/api/` route handler (publik, auth, admin, cron). Setiap mutasi memeriksa sesi, izin, Origin, dan Zod di server.
- `src/app/(site)/` halaman publik, `src/app/admin/` panel admin, `src/proxy.ts` gerbang `/admin` dan CSP bernonce.
- `public/brand/` tempat logo dan ikon (lihat README di dalamnya).

## Keputusan dan penyimpangan dari MTS

- **HTML mentah (`html_raw`)** dirender dari `/embed/news/[slug]` dengan CSP `sandbox` tanpa `allow-same-origin` (bukan `srcdoc`), karena iframe `srcdoc` mewarisi CSP induk dan skripnya akan diblokir.
- **Caching:** halaman dirender per permintaan dan data dibaca lewat `unstable_cache` bertag. `revalidateTag(tag, { expire: 0 })` dipanggil saat admin menyimpan sehingga perubahan tampil segera.
- **Lampiran pengaduan** disimpan di koleksi MongoDB privat dan dilayani lewat proxy terotorisasi, tidak pernah lewat URL publik. Tanpa pemindai malware, status tetap `pending_scan` dan admin tidak dapat mengunduh (sesuai Section 29.8). Daftarkan pemindai lewat `registerScanner()` di `src/lib/attachments.ts`.
- **Berita terjadwal** tampil bila `publishedAt <= now` (dievaluasi saat query, tanpa cron).
- Em dash tidak dipakai di seluruh proyek.

## Risiko terbuka

1. **Vercel membatasi body fungsi sekitar 4,5 MB.** Lampiran pengaduan diunggah satu berkas per permintaan dan dibatasi 4,4 MB di Vercel walau aturan produk 10 MB. Produksi butuh storage privat dengan pre-signed upload.
2. **Cron 15 menit** (`vercel.json`) membutuhkan paket Vercel yang mendukungnya. Paket gratis hanya harian, jadi keterlambatan auto-close bisa hingga 24 jam. Dokumentasikan sebelum dipakai.
3. **Belum diuji dengan SMTP dan Vercel Blob sungguhan** (kredensial belum ada): kirim email dan unggah media baru terverifikasi sampai batas validasi dan penanganan error.
4. Pengujian axe otomatis tidak menggantikan uji pembaca layar manual. Kualitas suara TTS bergantung perangkat.
5. Semua gate di MTS Section 28 dan 29.14 (hosting resmi, privasi, retensi, VA/PT) tetap menunggu keputusan pemilik sistem.
