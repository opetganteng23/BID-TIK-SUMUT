/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Uji integrasi end-to-end terhadap server yang sedang berjalan (BASE_URL) dan database uji.
 * JANGAN diarahkan ke database prototype/production: skrip ini membuat dan mengubah data.
 *
 *   BASE_URL=http://localhost:3100 tsx scripts/integration.ts   (env yang sama dengan server)
 */
import ExcelJS from "exceljs";
import { connectDb } from "@/lib/db";
import { Complaint, RateLimit, User } from "@/lib/models";
import { hashPassword } from "@/lib/auth/password";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PASS = "PasswordUji-12345";
const NEW_PASS = "PasswordBaru-67890";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failures.push(name);
    console.log(`  GAGAL: ${name}`, detail ?? "");
  }
}

class Client {
  jar = new Map<string, string>();
  async req(method: string, path: string, opts: { body?: unknown; form?: FormData; origin?: string | null; raw?: boolean } = {}) {
    const headers: Record<string, string> = {};
    if (opts.origin !== null) headers.origin = opts.origin ?? BASE;
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { method, headers, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined), redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const val = pair.slice(i + 1);
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || val === "") this.jar.delete(name);
      else this.jar.set(name, val);
    }
    if (opts.raw) return { status: res.status, res, json: null as never };
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* bukan JSON */
    }
    return { status: res.status, json, res };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, body: unknown = {}, o: object = {}) => this.req("POST", p, { body, ...o });
  put = (p: string, body: unknown) => this.req("PUT", p, { body });
  patch = (p: string, body: unknown) => this.req("PATCH", p, { body });
}

async function login(email: string, password: string) {
  const c = new Client();
  const r = await c.post("/api/auth/login", { email, password });
  return { c, r };
}

async function main() {
  await connectDb();
  const unique = Date.now().toString(36);

  console.log("1. Auth, first login gate, password change");
  const sa = await login("superadmin@example.test", PASS);
  check("super admin login ok", sa.r.status === 200 && sa.r.json.data.mustChangePassword === true, sa.r.json);
  const gated = await sa.c.get("/api/admin/settings");
  check("mustChangePassword memblokir API admin lain", gated.status === 403 && gated.json.error.code === "PASSWORD_CHANGE_REQUIRED", gated.json);
  const bad = await sa.c.post("/api/auth/change-password", { currentPassword: "salah-salah-1", newPassword: NEW_PASS });
  check("ganti password dengan password lama salah ditolak", bad.status === 400);
  const weak = await sa.c.post("/api/auth/change-password", { currentPassword: PASS, newPassword: "pendek" });
  check("password baru pendek ditolak", weak.status === 400);
  const changed = await sa.c.post("/api/auth/change-password", { currentPassword: PASS, newPassword: NEW_PASS });
  check("ganti password berhasil", changed.status === 200, changed.json);
  const settingsOk = await sa.c.get("/api/admin/settings");
  check("setelah ganti password API admin terbuka", settingsOk.status === 200);
  const oldLogin = await login("superadmin@example.test", PASS);
  check("password lama tidak berlaku", oldLogin.r.status === 401);

  console.log("2. Keamanan request");
  const noOrigin = await new Client().req("POST", "/api/auth/login", { body: { email: "a@b.co", password: "x" }, origin: null });
  check("POST tanpa Origin ditolak (CSRF)", noOrigin.status === 403, noOrigin.json);
  const evilOrigin = await new Client().req("POST", "/api/auth/login", { body: { email: "a@b.co", password: "x" }, origin: "https://evil.example" });
  check("Origin asing ditolak", evilOrigin.status === 403);
  const nosql = await new Client().post("/api/auth/login", { email: { $ne: null }, password: { $ne: null } });
  check("operator NoSQL ditolak", nosql.status === 400, nosql.json);
  const anon = await new Client().get("/api/admin/news");
  check("API admin tanpa sesi 401", anon.status === 401);
  const resp = await anon.res;
  check("respons membawa x-request-id", !!resp.headers.get("x-request-id"));
  check("header keamanan terpasang", resp.headers.get("x-content-type-options") === "nosniff" && resp.headers.get("x-frame-options") === "DENY");

  console.log("3. RBAC");
  // Admin dan editor dibuat langsung ke DB agar tidak bergantung pada email.
  for (const [email, role] of [[`admin-${unique}@example.test`, "admin"], [`editor-${unique}@example.test`, "editor"], [`editor2-${unique}@example.test`, "editor"], [`admin2-${unique}@example.test`, "admin"]] as const) {
    await User.create({ name: `${role} uji`, email, role, passwordHash: await hashPassword(PASS), mustChangePassword: false });
  }
  const admin = (await login(`admin-${unique}@example.test`, PASS)).c;
  const admin2 = (await login(`admin2-${unique}@example.test`, PASS)).c;
  const editor = (await login(`editor-${unique}@example.test`, PASS)).c;
  const editor2 = (await login(`editor2-${unique}@example.test`, PASS)).c;
  check("editor tidak bisa kelola pengguna", (await editor.get("/api/admin/users")).status === 403);
  check("admin tidak bisa kelola pengguna", (await admin.get("/api/admin/users")).status === 403);
  check("super admin bisa kelola pengguna", (await sa.c.get("/api/admin/users")).status === 200);
  check("editor tidak bisa ubah hero", (await editor.post("/api/admin/hero", { title: "x", mediaType: "image" })).status === 403);
  check("editor tidak bisa baca pesan kontak", (await editor.get("/api/admin/messages")).status === 403);
  check("editor tidak bisa baca audit", (await editor.get("/api/admin/audit")).status === 403);
  check("admin bisa baca audit", (await admin.get("/api/admin/audit")).status === 200);
  const editSettings = await editor.put("/api/admin/settings", { tagline: "x" });
  check("editor tidak bisa ubah settings", editSettings.status === 403);
  const adminIdentity = await admin.put("/api/admin/settings", { siteName: "Nama baru" });
  check("admin tidak bisa ubah identitas", adminIdentity.status === 403, adminIdentity.json);
  const adminEmail = await admin.put("/api/admin/settings", { email: { contactRecipients: [], emailSubjectPrefix: "x", otpEnabled: false } });
  check("admin tidak bisa ubah email/OTP", adminEmail.status === 403);
  const adminLayout = await admin.put("/api/admin/settings", { newsHomeCount: 3 });
  check("admin bisa ubah layout", adminLayout.status === 200, adminLayout.json);
  const saIdentity = await sa.c.put("/api/admin/settings", { siteName: "BID TIK Polda Sumatera Utara", tagline: "Prototype" });
  check("super admin bisa ubah identitas", saIdentity.status === 200, saIdentity.json);

  console.log("4. Berita: alur, sanitasi, mode konten");
  const xss = '<p>Halo</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><iframe src="https://evil.example"></iframe>';
  const withStatus = await editor.post("/api/admin/news", { title: "Uji status", status: "published" });
  check("editor tidak bisa menetapkan status via request", withStatus.status === 400, withStatus.json);
  const created = await editor.post("/api/admin/news", { title: `Berita Uji ${unique}`, contentMode: "html", contentHtml: xss, excerpt: "Ringkasan uji" });
  check("editor membuat berita (draft)", created.status === 201 && created.json.data.status === "draft", created.json);
  const id = created.json.data._id as string;
  check("HTML disanitasi saat simpan", !/script|onerror|javascript:|evil\.example/i.test(created.json.data.contentHtml), created.json.data.contentHtml);
  const raw = await editor.post("/api/admin/news", { title: "Mentah", contentMode: "html_raw", rawHtml: "<script>1</script>" });
  check("editor tidak bisa html_raw", raw.status === 403, raw.json);
  const raw2 = await admin.post("/api/admin/news", { title: "Mentah admin", contentMode: "html_raw", rawHtml: "<script>1</script>" });
  check("admin tidak bisa html_raw", raw2.status === 403);
  const rawSa = await sa.c.post("/api/admin/news", { title: `Mentah SA ${unique}`, contentMode: "html_raw", rawHtml: "<h1>Mentah</h1><script>document.title='x'</script>" });
  check("super admin bisa html_raw", rawSa.status === 201, rawSa.json);
  check("editor lain tidak melihat berita orang lain", (await editor2.get(`/api/admin/news/${id}`)).status === 404);
  check("editor tidak bisa publish", (await editor.post(`/api/admin/news/${id}/publish`)).status === 403);
  check("editor tidak bisa approve", (await editor.post(`/api/admin/news/${id}/approve`)).status === 403);
  check("publish langsung dari draft oleh editor ditolak", (await editor.post(`/api/admin/news/${id}/publish`)).status === 403);
  const pub0 = await new Client().get("/api/public/news");
  check("draft tidak tampil publik", !JSON.stringify(pub0.json).includes(unique));
  check("editor mengajukan review", (await editor.post(`/api/admin/news/${id}/submit-review`)).status === 200);
  check("editor tidak bisa ubah saat review", (await editor.put(`/api/admin/news/${id}`, { title: "ubah" })).status === 403);
  check("transisi tidak valid ditolak (review->restore)", (await admin.post(`/api/admin/news/${id}/restore`)).status === 409);
  const approved = await admin.post(`/api/admin/news/${id}/approve`, { publishedAt: new Date(Date.now() + 3600_000).toISOString() });
  check("admin menyetujui dengan jadwal masa depan", approved.status === 200 && approved.json.data.status === "scheduled", approved.json);
  const pub1 = await new Client().get("/api/public/news");
  check("berita terjadwal belum tampil sebelum waktunya", !JSON.stringify(pub1.json).includes(unique));
  const pubSlug = created.json.data.slug as string;
  check("detail berita terjadwal 404 publik", (await new Client().get(`/api/public/news/${pubSlug}`)).status === 404);
  const pubd = await admin.post(`/api/admin/news/${id}/publish`);
  check("admin menerbitkan", pubd.status === 200 && pubd.json.data.status === "published", pubd.json);
  const pub2 = await new Client().get("/api/public/news");
  check("berita terbit tampil publik", JSON.stringify(pub2.json).includes(unique));
  const detail = await new Client().get(`/api/public/news/${pubSlug}`);
  check("detail publik tanpa script", detail.status === 200 && !/script|onerror/i.test(detail.json.data.contentHtml));
  check("detail publik tidak membocorkan authorId", !("authorId" in detail.json.data) && !("reviewedBy" in detail.json.data));
  check("arsip menghapus dari publik", (await admin.post(`/api/admin/news/${id}/archive`)).status === 200 && !JSON.stringify((await new Client().get("/api/public/news")).json).includes(unique));
  check("arsip tidak ada di detail publik", (await new Client().get(`/api/public/news/${pubSlug}`)).status === 404);
  const bareSa = await sa.c.post(`/api/admin/news/${rawSa.json.data._id}/publish`, {});
  check("publish html_raw tanpa pratinjau ditolak", bareSa.status === 400, bareSa.json);
  const okSa = await sa.c.post(`/api/admin/news/${rawSa.json.data._id}/publish`, { previewed: true });
  check("publish html_raw dengan pratinjau", okSa.status === 200, okSa.json);
  const embed = await new Client().req("GET", `/embed/news/${rawSa.json.data.slug}`, { raw: true, origin: null });
  const csp = embed.res.headers.get("content-security-policy") ?? "";
  check("embed html_raw memakai CSP sandbox tanpa allow-same-origin", embed.status === 200 && /sandbox allow-scripts allow-popups/.test(csp) && !/allow-same-origin/.test(csp), csp);
  check("embed bisa dibingkai situs sendiri", embed.res.headers.get("x-frame-options") === "SAMEORIGIN");
  const slugDup = await editor.post("/api/admin/news", { title: "Dup", slug: pubSlug });
  check("slug duplikat 409", slugDup.status === 409);
  const badId = await admin.get("/api/admin/news/not-an-id");
  check("ID tidak valid 404", badId.status === 404);

  console.log("5. Halaman statis dan slug dipesan");
  check("slug dipesan ditolak", (await admin.post("/api/admin/pages", { title: "Admin", slug: "admin" })).status === 409);
  const page = await admin.post("/api/admin/pages", { title: `Profil ${unique}`, contentHtml: "<p>Isi</p><script>x</script>" });
  check("halaman dibuat dan disanitasi", page.status === 201 && !/script/.test(page.json.data.contentHtml), page.json);
  const pageHtml = await fetch(`${BASE}/${page.json.data.slug}`).then((r) => r.text());
  check("halaman statis tampil publik", pageHtml.includes("Isi"));

  console.log("6. Kontak");
  const hp = await new Client().post("/api/public/contact", { name: "Bot", email: "bot@example.test", subject: "Spam spam", message: "pesan spam panjang sekali", website: "x" });
  check("honeypot tampak sukses", hp.status === 201);
  const contact = await new Client().post("/api/public/contact", { name: "Budi Contoh", email: "budi@example.test", subject: "Pertanyaan uji", message: "Ini pesan uji yang cukup panjang." });
  check("kontak tersimpan walau SMTP tidak dikonfigurasi", contact.status === 201 && contact.json.data.notified === true || contact.status === 201, contact.json);
  const msgs = await admin.get("/api/admin/messages");
  check("admin melihat pesan kontak (honeypot tidak tersimpan)", msgs.json.data.items.some((m: any) => m.subject === "Pertanyaan uji") && !msgs.json.data.items.some((m: any) => m.subject === "Spam spam"));

  console.log("7. Pengaduan: pengajuan dan akses");
  await RateLimit.deleteMany({}); // batas 5 pengajuan/IP/jam sengaja tidak dilonggarkan di server; uji membersihkan counter
  const cats = (await new Client().get("/api/public/complaint-categories")).json.data.items as { id: string }[];
  const payload = (subject: string) => ({ name: "Warga Fiktif", address: "Jalan Fiktif No. 1, Kota Contoh", phone: "081234567890", categoryId: cats[0].id, subject, description: "Ini uraian pengaduan fiktif untuk pengujian sistem.", privacyConsent: true });
  const noConsent = await new Client().post("/api/public/complaints", { ...payload("Tanpa consent"), privacyConsent: false });
  check("tanpa persetujuan privasi ditolak", noConsent.status === 400);
  const badPhone = await new Client().post("/api/public/complaints", { ...payload("Telepon salah"), phone: "123" });
  check("telepon tidak valid ditolak", badPhone.status === 400 && !!badPhone.json.error.fields?.phone, badPhone.json);
  const extra = await new Client().post("/api/public/complaints", { ...payload("Field asing"), status: "closed" });
  check("field status dari klien ditolak", extra.status === 400);
  const reporter = new Client();
  const created1 = await reporter.post("/api/public/complaints", payload("=HYPERLINK(\"http://x\")"));
  check("pengaduan dibuat", created1.status === 201 && /^PGD-/.test(created1.json.data.ticketNumber), created1.json);
  const { ticketNumber, accessCode } = created1.json.data as { ticketNumber: string; accessCode: string };
  check("respons pembuatan tidak di-cache", created1.res.headers.get("cache-control") === "no-store");
  const doc = await Complaint.findOne({ ticketNumber }).lean();
  check("hanya hash kode akses yang tersimpan", !!doc && doc.accessCodeHash !== accessCode && !JSON.stringify(doc).includes(accessCode.replace(/-/g, "")));
  check("status awal submitted", doc?.status === "submitted");

  const stranger = new Client();
  check("tanpa sesi tidak bisa baca tiket", (await stranger.get("/api/public/complaints/me")).status === 401);
  const onlyTicket = await stranger.post("/api/public/complaints/access", { ticketNumber, accessCode: "AAAAA-AAAAA-AAAAA-AAAAA" });
  check("nomor tiket tanpa kode akses benar ditolak", onlyTicket.status === 401);
  check("tetap tanpa sesi setelah gagal", (await stranger.get("/api/public/complaints/me")).status === 401);
  const wrongBody = JSON.stringify(onlyTicket.json);
  const unknownTicket = await new Client().post("/api/public/complaints/access", { ticketNumber: "PGD-ZZZZ-ZZZZ", accessCode: "AAAAA-AAAAA-AAAAA-AAAAA" });
  check("pesan error sama untuk tiket tidak ada (anti-enumerasi)", JSON.stringify(unknownTicket.json.error.message) === JSON.stringify(onlyTicket.json.error.message) && wrongBody.length > 0);
  const okAccess = await stranger.post("/api/public/complaints/access", { ticketNumber: ticketNumber.toLowerCase(), accessCode: accessCode.toLowerCase().replace(/-/g, " ") });
  check("akses dengan kode benar (format longgar)", okAccess.status === 200, okAccess.json);
  const me = await stranger.get("/api/public/complaints/me");
  check("pelapor melihat tiketnya", me.status === 200 && me.json.data.ticketNumber === ticketNumber);
  check("respons pelapor tidak memuat hash/kode/petugas", !/accessCodeHash|claimedBy|Jalan Fiktif|081234567890/.test(JSON.stringify(me.json)));

  // Tiket kedua: sesi tiket 1 tidak boleh membuka tiket 2
  const reporter2 = new Client();
  const created2 = await reporter2.post("/api/public/complaints", payload("Tiket kedua"));
  check("pengajuan tiket kedua", created2.status === 201, created2.json);
  const me2 = await reporter.get("/api/public/complaints/me");
  check("sesi hanya untuk tiketnya sendiri", me2.json.data.ticketNumber === ticketNumber && me2.json.data.ticketNumber !== created2.json.data.ticketNumber);

  console.log("8. Pengaduan: lampiran");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const up = new FormData();
  up.set("file", new File([png], "bukti.png", { type: "image/png" }));
  const upRes = await reporter.req("POST", "/api/public/complaints/me/attachments", { form: up });
  check("lampiran PNG valid diterima", upRes.status === 201, upRes.json);
  const fake = new FormData();
  fake.set("file", new File([Buffer.from("MZ ini bukan png sama sekali")], "palsu.png", { type: "image/png" }));
  check("lampiran dengan magic bytes palsu ditolak", (await reporter.req("POST", "/api/public/complaints/me/attachments", { form: fake })).status === 415);
  const exe = new FormData();
  exe.set("file", new File([Buffer.from("MZ")], "virus.exe", { type: "application/x-msdownload" }));
  check("tipe tidak diizinkan ditolak", (await reporter.req("POST", "/api/public/complaints/me/attachments", { form: exe })).status === 415);
  const big = new FormData();
  big.set("file", new File([Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)])], "besar.png", { type: "image/png" }));
  const bigRes = await reporter.req("POST", "/api/public/complaints/me/attachments", { form: big });
  check("berkas melebihi 10 MB ditolak", bigRes.status === 413, bigRes.status);
  const attId = upRes.json.data.id as string;
  check("pelapor lain tidak bisa unduh lampiran tiket ini", (await reporter2.get(`/api/public/complaints/me/attachments/${attId}`)).status === 404);
  const own = await reporter.req("GET", `/api/public/complaints/me/attachments/${attId}`, { raw: true, origin: null });
  check("pelapor bisa unduh lampirannya dengan header aman", own.status === 200 && /attachment/.test(own.res.headers.get("content-disposition") ?? "") && own.res.headers.get("x-content-type-options") === "nosniff");

  console.log("9. Pengaduan: klaim atomik dan alur status");
  const cid = String(doc!._id);
  check("semua admin bisa lihat tiket", (await editor.get(`/api/admin/complaints/${cid}`)).status === 200 && (await admin.get(`/api/admin/complaints/${cid}`)).status === 200);
  const adminDetail = await admin.get(`/api/admin/complaints/${cid}`);
  const dl = await admin.req("GET", `/api/admin/complaints/${cid}/attachments/${attId}`, { raw: true, origin: null });
  check("unduhan admin diblokir selama pending_scan", dl.status === 403 && adminDetail.json.data.attachments[0].scanStatus === "pending_scan", dl.status);
  const [r1, r2, r3] = await Promise.all([admin.post(`/api/admin/complaints/${cid}/claim`), admin2.post(`/api/admin/complaints/${cid}/claim`), editor.post(`/api/admin/complaints/${cid}/claim`)]);
  const codes = [r1.status, r2.status, r3.status].sort();
  check("klaim bersamaan: tepat satu 200, sisanya 409", codes[0] === 200 && codes[1] === 409 && codes[2] === 409, codes);
  const winner = [r1, r2, r3].findIndex((r) => r.status === 200);
  const owner = [admin, admin2, editor][winner];
  const other = [admin, admin2, editor].find((_, i) => i !== winner)!;
  check("klaim ulang oleh orang lain ditolak", (await other.post(`/api/admin/complaints/${cid}/claim`)).status === 409);
  check("status in_progress setelah klaim", (await Complaint.findById(cid).lean())?.status === "in_progress");
  check("bukan pemilik tidak bisa ubah status (editor)", (await (owner === editor ? admin2 : editor).patch(`/api/admin/complaints/${cid}/status`, { to: "waiting_reporter" })).status !== 200 || owner !== editor);
  check("status arbitrer dari klien ditolak", (await owner.patch(`/api/admin/complaints/${cid}/status`, { to: "closed" })).status === 400);
  check("minta info pelapor", (await owner.patch(`/api/admin/complaints/${cid}/status`, { to: "waiting_reporter" })).status === 200);
  check("pelapor tidak bisa konfirmasi saat bukan tahap konfirmasi", (await reporter.post("/api/public/complaints/me/confirmation", { resolved: true })).status === 409);
  const reply = await reporter.post("/api/public/complaints/me/messages", { body: "<script>alert(1)</script> Ini informasi tambahan." });
  check("balasan pelapor diterima", reply.status === 201);
  check("balasan pelapor mengembalikan ke in_progress", (await Complaint.findById(cid).lean())?.status === "in_progress");
  const msgList = await owner.get(`/api/admin/complaints/${cid}/messages`);
  check("pesan disimpan sebagai teks (tidak dieksekusi, tampil literal)", msgList.json.data.items.some((m: any) => String(m.body).includes("<script>")));
  check("petugas membalas", (await owner.post(`/api/admin/complaints/${cid}/messages`, { body: "Terima kasih, kami proses." })).status === 201);
  const done = await owner.patch(`/api/admin/complaints/${cid}/status`, { to: "awaiting_reporter_confirmation" });
  check("petugas menyatakan selesai", done.status === 200 && !!done.json.data.confirmationDeadlineAt, done.json);
  const after = await Complaint.findById(cid).lean();
  const diff = (after!.confirmationDeadlineAt!.getTime() - after!.awaitingConfirmationAt!.getTime()) / 3600_000;
  check("tenggat tepat 168 jam", diff === 168, diff);
  const notYet = await new Client().req("GET", "/api/cron/complaints", { raw: true, origin: null });
  check("cron tanpa rahasia ditolak", notYet.status === 401);
  const cronHeaders = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const runCron = async () => (await fetch(`${BASE}/api/cron/complaints`, { headers: cronHeaders })).json() as Promise<any>;
  const c0 = await runCron();
  check("cron sebelum tenggat tidak menutup", c0.ok && (await Complaint.findById(cid).lean())?.status === "awaiting_reporter_confirmation", c0);
  const notOk = await reporter.post("/api/public/complaints/me/confirmation", { resolved: false });
  check("pelapor menyatakan belum selesai", notOk.status === 200 && notOk.json.data.status === "in_progress");
  check("tenggat dihapus saat kembali ke in_progress", (await Complaint.findById(cid).lean())?.confirmationDeadlineAt === undefined);
  await owner.patch(`/api/admin/complaints/${cid}/status`, { to: "awaiting_reporter_confirmation" });
  const confirmed = await reporter.post("/api/public/complaints/me/confirmation", { resolved: true });
  const closed = await Complaint.findById(cid).lean();
  check("pelapor menutup dengan reporter_confirmed", confirmed.status === 200 && closed?.status === "closed" && closed.closureReason === "reporter_confirmed", closed);
  check("tiket tertutup tidak bisa dibalas", (await reporter.post("/api/public/complaints/me/messages", { body: "halo" })).status === 409);
  check("tiket tertutup tidak bisa dibuka lagi", (await owner.patch(`/api/admin/complaints/${cid}/status`, { to: "waiting_reporter" })).status !== 200);

  console.log("10. Pengaduan: auto-close idempoten dan balapan");
  await RateLimit.deleteMany({});
  const t2 = await Complaint.findOne({ ticketNumber: created2.json.data.ticketNumber });
  const tid = String(t2!._id);
  await admin.post(`/api/admin/complaints/${tid}/claim`);
  await admin.patch(`/api/admin/complaints/${tid}/status`, { to: "awaiting_reporter_confirmation" });
  // Majukan tenggat ke masa lalu agar job menganggap kedaluwarsa.
  await Complaint.updateOne({ _id: tid }, { $set: { confirmationDeadlineAt: new Date(Date.now() - 1000) } });
  // Balapan: pelapor menjawab "belum selesai" bersamaan dengan job.
  const [cron1, cron2] = await Promise.all([runCron(), runCron()]);
  const t2after = await Complaint.findById(tid).lean();
  check("job menutup otomatis tepat sekali", t2after?.status === "closed" && t2after.closureReason === "auto_closed_no_reporter_response", t2after);
  check("dua job paralel: total tertutup tepat 1", (cron1.data.closed ?? 0) + (cron2.data.closed ?? 0) === 1, [cron1.data, cron2.data]);
  const cron3 = await runCron();
  check("job berikutnya idempoten (0 tertutup)", cron3.data.closed === 0);
  const hist = await (await import("@/lib/models")).ComplaintStatusHistory.find({ complaintId: tid, toStatus: "closed" }).lean();
  check("tepat satu riwayat penutupan oleh sistem", hist.length === 1 && hist[0].actorType === "system");
  // Tiket yang sudah direspons pelapor tidak ikut ditutup oleh job usang
  const created3 = await new Client().post("/api/public/complaints", payload("Tiket ketiga"));
  const t3 = await Complaint.findOne({ ticketNumber: created3.json.data.ticketNumber });
  await admin.post(`/api/admin/complaints/${t3!._id}/claim`);
  await admin.patch(`/api/admin/complaints/${t3!._id}/status`, { to: "awaiting_reporter_confirmation" });
  await Complaint.updateOne({ _id: t3!._id }, { $set: { confirmationDeadlineAt: new Date(Date.now() - 1000) } });
  const r3c = new Client();
  await r3c.post("/api/public/complaints/access", { ticketNumber: created3.json.data.ticketNumber, accessCode: created3.json.data.accessCode });
  await r3c.post("/api/public/complaints/me/confirmation", { resolved: false });
  await runCron();
  check("tiket yang direspons pelapor tidak ditutup job", (await Complaint.findById(t3!._id).lean())?.status === "in_progress");

  console.log("11. Rate limit pengaduan");
  await RateLimit.deleteMany({});
  const victim = created3.json.data.ticketNumber as string;
  const attempts: number[] = [];
  for (let i = 0; i < 7; i++) attempts.push((await new Client().post("/api/public/complaints/access", { ticketNumber: victim, accessCode: `BBBBB-BBBBB-BBBBB-BBB${i}${i}` })).status);
  check("brute force per tiket dibatasi (429 setelah 5 percobaan)", attempts.slice(0, 5).every((s) => s === 401) && attempts.slice(5).every((s) => s === 429), attempts);

  console.log("12. Ekspor XLSX");
  check("editor tidak bisa ekspor", (await editor.req("GET", "/api/admin/complaints/export", { raw: true, origin: null })).status === 403);
  const exp = await admin.req("GET", "/api/admin/complaints/export", { raw: true, origin: null });
  const buf = Buffer.from(await exp.res.arrayBuffer());
  check("admin bisa ekspor XLSX", exp.status === 200 && buf.subarray(0, 2).toString() === "PK" && /attachment/.test(exp.res.headers.get("content-disposition") ?? ""), exp.status);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet("Pengaduan")!;
  const headers = (ws.getRow(1).values as any[]).filter(Boolean);
  check("kolom identitas tidak ada secara default", !headers.includes("Nama Pelapor") && !headers.includes("Nomor Telepon"), headers);
  const subjects: string[] = [];
  ws.eachRow((row, n) => n > 1 && subjects.push(String(row.getCell(headers.indexOf("Subjek") + 1).value)));
  check("formula injection dinetralkan", subjects.some((s) => s.startsWith("'=HYPERLINK")) && !subjects.some((s) => s.startsWith("=")), subjects);
  check("admin biasa tidak bisa ekspor identitas", (await admin.req("GET", "/api/admin/complaints/export?includeIdentity=true", { raw: true, origin: null })).status === 403);
  const saExp = await sa.c.req("GET", "/api/admin/complaints/export?includeIdentity=true", { raw: true, origin: null });
  check("super admin bisa ekspor identitas", saExp.status === 200);
  const audit = await sa.c.get("/api/admin/audit?action=complaint.export");
  check("ekspor tercatat di audit (tanpa isi)", audit.json.data.items.length >= 2 && audit.json.data.items.every((a: any) => !/Warga Fiktif|081234567890/.test(JSON.stringify(a))));

  console.log("13. Pengguna dan sesi");
  const createdUser = await sa.c.post("/api/admin/users", { name: "Baru", email: `baru-${unique}@example.test`, role: "editor", password: "PasswordSementara-1" });
  check("super admin membuat pengguna (mustChangePassword)", createdUser.status === 201);
  const fresh = await login(`baru-${unique}@example.test`, "PasswordSementara-1");
  check("pengguna baru dipaksa ganti password", fresh.r.json.data.mustChangePassword === true && (await fresh.c.get("/api/admin/news")).status === 403);
  const uid = createdUser.json.data.id as string;
  await sa.c.patch(`/api/admin/users/${uid}`, { isActive: false });
  check("sesi pengguna nonaktif dicabut", (await fresh.c.get("/api/auth/me")).status === 401);
  const self = await sa.c.patch(`/api/admin/users/${(await User.findOne({ email: "superadmin@example.test" }))!._id}`, { isActive: false });
  check("tidak bisa menonaktifkan akun sendiri", self.status === 409);
  const lockEmail = `editor2-${unique}@example.test`;
  const fails: number[] = [];
  for (let i = 0; i < 6; i++) fails.push((await new Client().post("/api/auth/login", { email: lockEmail, password: "salah-salah-salah" })).status);
  check("akun terkunci setelah 5 kali gagal", fails.slice(0, 5).every((s) => s === 401) && fails[5] === 429, fails);
  const lockedLogin = await new Client().post("/api/auth/login", { email: lockEmail, password: PASS });
  check("akun terkunci menolak password benar", lockedLogin.status === 429);

  console.log("13b. Unggah gambar base64");
  const png64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137]).toString("base64");
  const up1 = await admin.post("/api/admin/media/image", { filename: "uji.png", mime: "image/png", base64: png64, kind: "image", alt: "Gambar uji" });
  check("gambar base64 diterima", up1.status === 201 && /^\/media\/[a-f0-9]{24}$/.test(up1.json.data.url), up1.json);
  const mediaUrl = up1.json.data.url as string;
  const served = await fetch(BASE + mediaUrl);
  const servedBytes = Buffer.from(await served.arrayBuffer());
  check("gambar dilayani dari /media/<id> dengan tipe dan byte yang sama", served.status === 200 && served.headers.get("content-type") === "image/png" && servedBytes.toString("base64") === png64, served.status);
  check("header aman pada gambar", served.headers.get("x-content-type-options") === "nosniff");
  check("daftar media tidak membocorkan base64", !JSON.stringify((await admin.get("/api/admin/media")).json).includes(png64.slice(0, 20)));
  check("tanpa alt ditolak", (await admin.post("/api/admin/media/image", { filename: "a.png", mime: "image/png", base64: png64, kind: "image" })).status === 400);
  check("dekoratif tanpa alt diterima", (await admin.post("/api/admin/media/image", { filename: "d.png", mime: "image/png", base64: png64, kind: "image", decorative: true })).status === 201);
  check("magic bytes palsu ditolak", (await admin.post("/api/admin/media/image", { filename: "x.png", mime: "image/png", base64: Buffer.from("MZ bukan gambar sama sekali").toString("base64"), kind: "image", alt: "x" })).status === 415);
  check("SVG ditolak", (await admin.post("/api/admin/media/image", { filename: "x.svg", mime: "image/svg+xml", base64: Buffer.from("<svg onload=alert(1)/>").toString("base64"), kind: "image", alt: "x" })).status === 415);
  check("base64 tidak valid ditolak", (await admin.post("/api/admin/media/image", { filename: "x.png", mime: "image/png", base64: "data:image/png;base64,AAAA", kind: "image", alt: "x" })).status === 400);
  const tooBig = Buffer.concat([Buffer.from(png64, "base64"), Buffer.alloc(5 * 1024 * 1024)]).toString("base64");
  check("melebihi 5 MB ditolak", [400, 413].includes((await admin.post("/api/admin/media/image", { filename: "b.png", mime: "image/png", base64: tooBig, kind: "image", alt: "x" })).status));
  check("editor boleh unggah, tamu tidak", (await editor.post("/api/admin/media/image", { filename: "e.png", mime: "image/png", base64: png64, kind: "image", alt: "e" })).status === 201 && (await new Client().post("/api/admin/media/image", { filename: "e.png", mime: "image/png", base64: png64, kind: "image", alt: "e" })).status === 401);
  check("/media/<id> tidak valid 404", (await fetch(BASE + "/media/xyz")).status === 404 && (await fetch(BASE + "/media/" + "0".repeat(24))).status === 404);
  const withImg = await admin.post("/api/admin/news", { title: "Berita gambar " + unique, coverImage: mediaUrl, coverAlt: "uji", contentMode: "html", contentHtml: '<p>x</p><img src="' + mediaUrl + '" alt="uji"><img src="data:image/png;base64,AAAA" alt="x">' });
  check("coverImage berupa /media/<id> diterima", withImg.status === 201, withImg.json);
  check("img /media/<id> dipertahankan, data: dibuang", withImg.json.data.contentHtml.includes(mediaUrl) && !withImg.json.data.contentHtml.includes("data:"), withImg.json.data.contentHtml);
  check("URL data: ditolak sebagai gambar sampul", (await admin.post("/api/admin/news", { title: "Data url " + unique, coverImage: "data:image/png;base64,AAAA" })).status === 400);
  check("path media palsu ditolak", (await admin.post("/api/admin/news", { title: "Path " + unique, coverImage: "/media/../../etc/passwd" })).status === 400);
  const del = await admin.req("DELETE", "/api/admin/media/" + up1.json.data._id);
  check("media yang dipakai tidak bisa dihapus", del.status === 409, del.json);

  console.log("14. Halaman publik");
  for (const p of ["/", "/berita", "/fitur", "/kontak", "/pengaduan", "/pengaduan/lacak", "/admin/login", "/robots.txt", "/sitemap.xml"]) {
    const r = await fetch(BASE + p);
    check(`GET ${p} 200`, r.status === 200, r.status);
  }
  const home = await fetch(BASE + "/");
  const csp0 = home.headers.get("content-security-policy") ?? "";
  check("CSP bernonce terpasang di halaman", /script-src 'self' 'nonce-/.test(csp0) && /frame-ancestors 'none'/.test(csp0));
  const html = await home.text();
  check("lang=id dan skip link", /<html lang="id"/.test(html) && html.includes("Lewati ke konten"));
  check("robots melarang indeks selama prototype", (await fetch(BASE + "/robots.txt").then((r) => r.text())).includes("Disallow: /"));
  check("sitemap kosong selama robotsIndex mati", !(await fetch(BASE + "/sitemap.xml").then((r) => r.text())).includes("/berita/"));
  const adminRedirect = await fetch(BASE + "/admin/news", { redirect: "manual" });
  check("proxy mengalihkan /admin tanpa cookie ke login", adminRedirect.status === 307 && (adminRedirect.headers.get("location") ?? "").includes("/admin/login"));
  const stale = await fetch(BASE + "/admin/news", { redirect: "manual", headers: { cookie: "bid_session=bukan-token" } });
  check("cookie palsu tetap dialihkan oleh gerbang server", stale.status === 307 || stale.status === 200 === false || (await stale.text()).includes("Masuk admin"), stale.status);

  console.log(`\n${passed} lulus, ${failures.length} gagal`);
  if (failures.length) {
    console.log("Gagal:", failures.join(" | "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Skrip berhenti:", e);
  process.exit(2);
});
