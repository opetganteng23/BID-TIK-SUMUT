import { z } from "zod";
import ExcelJS from "exceljs";
import { ApiError, clientIp, parseQuery, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { Complaint } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";
import { safeCell, safeFileName } from "@/lib/xlsx-safe";
import { buildFilter, listQuery } from "@/lib/complaint-query";

export const maxDuration = 60;
const MAX_ROWS = 10_000;

const query = listQuery.extend({ includeIdentity: z.enum(["true", "false"]).default("false") });

const fmt = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

export const GET = route(async ({ req, requestId }) => {
  const user = await requireUser("complaints.export");
  const q = parseQuery(req, query);
  const includeIdentity = q.includeIdentity === "true";
  // Identitas pelapor hanya dengan izin khusus dan pilihan eksplisit.
  if (includeIdentity && !can(user.role, "complaints.export_sensitive")) {
    throw new ApiError("FORBIDDEN", "Anda tidak memiliki izin mengekspor identitas pelapor.");
  }
  // Rentang default: 30 hari terakhir.
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60_000);

  await connectDb();
  const filter = buildFilter({ ...q, from, to }, user.id);
  const rows = await Complaint.find(filter)
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .populate("categoryId", "name")
    .populate("claimedBy", "name")
    .lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pengaduan");
  const columns = [
    { header: "Nomor Tiket", key: "ticket", width: 18 },
    { header: "Tanggal Masuk (UTC)", key: "createdAt", width: 24 },
    ...(includeIdentity
      ? [
          { header: "Nama Pelapor", key: "name", width: 24 },
          { header: "Alamat", key: "address", width: 36 },
          { header: "Nomor Telepon", key: "phone", width: 18 },
        ]
      : []),
    { header: "Kategori", key: "category", width: 24 },
    { header: "Subjek", key: "subject", width: 36 },
    { header: "Ringkasan Uraian", key: "summary", width: 48 },
    { header: "Status", key: "status", width: 28 },
    { header: "Petugas", key: "officer", width: 22 },
    { header: "Waktu Klaim", key: "claimedAt", width: 24 },
    { header: "Mulai Menunggu Konfirmasi", key: "awaitingAt", width: 26 },
    { header: "Tenggat Konfirmasi", key: "deadline", width: 24 },
    { header: "Waktu Tutup", key: "closedAt", width: 24 },
    { header: "Alasan Penutupan", key: "closure", width: 30 },
    { header: "Durasi Penanganan (jam)", key: "duration", width: 22 },
    { header: "Aktivitas Terakhir", key: "lastActivity", width: 24 },
  ];
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };

  for (const c of rows) {
    const end = c.closedAt ?? new Date();
    const start = c.claimedAt ?? null;
    const cat = c.categoryId as unknown as { name?: string } | null;
    const officer = c.claimedBy as unknown as { name?: string } | null;
    const row: Record<string, unknown> = {
      ticket: c.ticketNumber,
      createdAt: fmt(c.createdAt),
      category: cat?.name,
      subject: c.subject,
      summary: c.description.slice(0, 200),
      status: STATUS_LABEL[c.status as ComplaintStatus],
      officer: officer?.name,
      claimedAt: fmt(c.claimedAt),
      awaitingAt: fmt(c.awaitingConfirmationAt),
      deadline: fmt(c.confirmationDeadlineAt),
      closedAt: fmt(c.closedAt),
      closure: c.closureReason,
      duration: start ? Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10 : null,
      lastActivity: fmt(c.lastMessageAt ?? c.updatedAt),
    };
    if (includeIdentity) {
      row.name = c.reporter?.name;
      row.address = c.reporter?.address;
      row.phone = c.reporter?.phone;
    }
    ws.addRow(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeCell(v)])));
  }

  const buffer = await wb.xlsx.writeBuffer();
  // Audit: aktor, filter, jumlah baris. Isi ekspor tidak dicatat.
  await audit({
    actorId: user.id,
    action: "complaint.export",
    entity: "complaint",
    summary: JSON.stringify({
      from: from.toISOString(),
      to: to.toISOString(),
      status: q.status,
      categoryId: q.categoryId,
      claimedBy: q.claimedBy,
      identity: includeIdentity,
      rows: rows.length,
    }),
    ip: clientIp(req),
    requestId,
  });
  const name = safeFileName(`pengaduan-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.xlsx`);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
