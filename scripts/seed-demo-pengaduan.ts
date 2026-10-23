/**
 * Membuat pengaduan FIKTIF untuk menguji dan mendemonstrasikan dashboard analitik.
 * Semua data ditandai: subjek berawalan "[DEMO]" dan nama pelapor "Warga Fiktif". Tidak ada data nyata.
 *
 *   pnpm seed:demo-pengaduan -- --count 150      buat 150 pengaduan acak selama 60 hari terakhir
 *   pnpm seed:demo-pengaduan -- --purge          hapus semua data DEMO
 *
 * Kode akses dibuat acak lalu dibuang (tidak ada yang dapat mengakses tiket DEMO lewat Lacak Pengaduan).
 */
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintAttachment, ComplaintCategory, ComplaintMessage, ComplaintStatusHistory, User } from "@/lib/models";
import { generateAccessCode, generateTicketNumber, hashAccessCode } from "@/lib/complaint-codes";
import { REGIONS } from "@/lib/regions";

const DAY = 86_400_000;
const HOUR = 3_600_000;

function rng(seed: number) {
  // Mulberry32: hasil dapat diulang agar demo konsisten.
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bobot wilayah: kota besar dan kabupaten padat lebih sering.
const WEIGHT: Record<string, number> = { medan: 30, "deli-serdang": 14, binjai: 7, langkat: 6, pematangsiantar: 6, simalungun: 5, asahan: 4, karo: 4, "tebing-tinggi": 3, labuhanbatu: 3, "tapanuli-utara": 2, sibolga: 2, padangsidimpuan: 2, toba: 2, "mandailing-natal": 2, "nias-selatan": 1, gunungsitoli: 1, dairi: 1, samosir: 1, "batu-bara": 2, "serdang-bedagai": 2, tanjungbalai: 2 };
const SUBJECTS = ["Pelayanan lambat di loket", "Petugas kurang ramah", "Informasi laporan tidak jelas", "Fasilitas ruang tunggu rusak", "Laporan belum ditindaklanjuti", "Antrean tidak tertib", "Pungutan tidak resmi diduga", "Jam layanan tidak sesuai", "Toilet umum tidak terawat", "Sulit menghubungi nomor layanan"];

async function main() {
  const purge = process.argv.includes("--purge");
  const countArg = process.argv.indexOf("--count");
  const count = Math.min(2000, Math.max(1, countArg > -1 ? Number(process.argv[countArg + 1]) || 150 : 150));
  await connectDb();

  if (purge) {
    const demo = await Complaint.find({ subject: /^\[DEMO\]/ }, "_id").lean();
    const ids = demo.map((d) => d._id);
    await Promise.all([ComplaintMessage.deleteMany({ complaintId: { $in: ids } }), ComplaintStatusHistory.deleteMany({ complaintId: { $in: ids } }), ComplaintAttachment.deleteMany({ complaintId: { $in: ids } })]);
    const r = await Complaint.deleteMany({ _id: { $in: ids } });
    console.log(`Dihapus: ${r.deletedCount} pengaduan DEMO.`);
    process.exit(0);
  }

  const cats = await ComplaintCategory.find({ active: true }).sort({ order: 1 }).lean();
  if (!cats.length) throw new Error("Belum ada kategori pengaduan. Jalankan pnpm seed terlebih dahulu.");
  const officers = await User.find({ isActive: true }, "_id").limit(3).lean();
  if (!officers.length) throw new Error("Belum ada pengguna. Jalankan pnpm seed terlebih dahulu.");

  const rand = rng(20261023);
  const pick = <T,>(items: readonly T[], weights: number[]) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
    return items[items.length - 1];
  };
  const regionW = REGIONS.map((g) => WEIGHT[g.slug] ?? 1);
  // Kategori pertama paling sering, lalu menurun; lokasi tiap kategori sedikit berbeda agar peta berwarna beragam.
  const catW = cats.map((_, i) => Math.max(1, 12 - i * 3));
  const pepper = "demo-pepper-".padEnd(32, "x");
  const now = Date.now();
  const docs = [];

  for (let i = 0; i < count; i++) {
    const created = new Date(now - rand() ** 1.3 * 60 * DAY - rand() * HOUR); // lebih banyak yang baru
    const wibHour = new Date(created.getTime() + 7 * HOUR).getUTCHours();
    if (wibHour < 6) created.setTime(created.getTime() + 6 * HOUR); // jarang tengah malam
    if (created.getTime() > now) created.setTime(now - HOUR);
    const age = now - created.getTime();
    const region = pick(REGIONS, regionW).slug;
    const category = pick(cats, catW);
    const officer = officers[Math.floor(rand() * officers.length)]._id;
    let status: string = "submitted";
    const f: Record<string, Date | string | Types.ObjectId | undefined> = {};
    const roll = rand();
    if (age > 2 * DAY && roll > 0.12) {
      f.claimedBy = officer;
      f.claimedAt = new Date(created.getTime() + (0.5 + rand() * 30) * HOUR);
      status = "in_progress";
      if (age > 5 * DAY && roll > 0.3) {
        const done = new Date((f.claimedAt as Date).getTime() + (4 + rand() * 90) * HOUR);
        if (done.getTime() < now) {
          f.awaitingConfirmationAt = done;
          f.confirmationDeadlineAt = new Date(done.getTime() + 7 * DAY);
          status = "awaiting_reporter_confirmation";
          const closeAt = rand() < 0.65 ? new Date(done.getTime() + (1 + rand() * 60) * HOUR) : (f.confirmationDeadlineAt as Date);
          if (closeAt.getTime() < now) {
            f.closedAt = closeAt;
            f.resolvedAt = closeAt;
            f.closureReason = closeAt === f.confirmationDeadlineAt ? "auto_closed_no_reporter_response" : "reporter_confirmed";
            f.confirmationDeadlineAt = undefined;
            status = "closed";
          }
        }
      } else if (roll > 0.2 && roll <= 0.3) status = "waiting_reporter";
    }
    docs.push({
      ticketNumber: generateTicketNumber(),
      accessCodeHash: hashAccessCode(generateAccessCode(), pepper),
      reporter: { name: "Warga Fiktif", address: "Alamat fiktif untuk demo", phone: "081200000000" },
      categoryId: category._id,
      region,
      subject: `[DEMO] ${SUBJECTS[Math.floor(rand() * SUBJECTS.length)]}`,
      description: "Data fiktif untuk demonstrasi dashboard analitik. Tidak mewakili kejadian nyata.",
      status,
      lastMessageAt: created,
      createdAt: created,
      updatedAt: created,
      ...f,
    });
  }
  await Complaint.collection.insertMany(docs as never[]);
  console.log(`Dibuat: ${docs.length} pengaduan DEMO (fiktif). Hapus dengan: pnpm seed:demo-pengaduan -- --purge`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
