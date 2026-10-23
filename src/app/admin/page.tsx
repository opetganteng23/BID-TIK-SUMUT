import type { Metadata } from "next";
import Link from "next/link";
import { requirePage } from "@/lib/auth/guard";
import { connectDb } from "@/lib/db";
import { AuditLog, Complaint, ContactMessage, News } from "@/lib/models";
import { can } from "@/lib/rbac";
import { Card, Notice } from "@/components/ui";
import { formatDate } from "@/components/api";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <Card className="h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-4xl font-semibold">{value}</p>
    </Card>
  );
  return href ? <Link href={href} className="block rounded-card focus-visible:outline-offset-4">{body}</Link> : body;
}

export default async function Dashboard(props: PageProps<"/admin">) {
  const user = await requirePage();
  const denied = (await props.searchParams).denied;
  await connectDb();
  const own = can(user.role, "news.manage_others") ? {} : { authorId: user.id };

  const [published, drafts, review, unread, activity, complaints] = await Promise.all([
    News.countDocuments({ ...own, status: "published" }),
    News.countDocuments({ ...own, status: "draft" }),
    News.countDocuments({ ...own, status: "review" }),
    can(user.role, "messages.manage") ? ContactMessage.countDocuments({ status: "new" }) : Promise.resolve(null),
    can(user.role, "audit.read") ? AuditLog.find({}, "action entity summary at").sort({ at: -1 }).limit(8).lean() : Promise.resolve(null),
    can(user.role, "complaints.view") ? Complaint.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]) : Promise.resolve(null),
  ]);
  const c = Object.fromEntries((complaints ?? []).map((g: { _id: string; n: number }) => [g._id, g.n])) as Record<string, number>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl">Halo, {user.name}</h1>
        <p className="mt-1 text-muted">Ringkasan aktivitas situs.</p>
      </div>
      {denied && <Notice kind="error">Anda tidak memiliki izin untuk membuka halaman tersebut.</Notice>}

      <section aria-labelledby="s-news">
        <h2 id="s-news" className="mb-3 text-xl">Berita</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Terbit" value={published} href="/admin/news?status=published" />
          <Stat label="Draft" value={drafts} href="/admin/news?status=draft" />
          <Stat label="Menunggu review" value={review} href="/admin/news?status=review" />
        </div>
      </section>

      {unread !== null && (
        <section aria-labelledby="s-msg">
          <h2 id="s-msg" className="mb-3 text-xl">Pesan kontak</h2>
          <div className="grid gap-4 sm:grid-cols-3"><Stat label="Belum dibaca" value={unread} href="/admin/messages" /></div>
        </section>
      )}

      {complaints && (
        <section aria-labelledby="s-cmp">
          <h2 id="s-cmp" className="mb-3 text-xl">Pengaduan</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Belum diambil" value={c.submitted ?? 0} href="/admin/complaints?status=submitted" />
            <Stat label="Sedang diproses" value={c.in_progress ?? 0} href="/admin/complaints?status=in_progress" />
            <Stat label="Menunggu info pelapor" value={c.waiting_reporter ?? 0} href="/admin/complaints?status=waiting_reporter" />
            <Stat label="Menunggu konfirmasi" value={c.awaiting_reporter_confirmation ?? 0} href="/admin/complaints?status=awaiting_reporter_confirmation" />
            <Stat label="Ditutup" value={c.closed ?? 0} href="/admin/complaints?status=closed" />
          </div>
        </section>
      )}

      {activity && (
        <section aria-labelledby="s-act">
          <h2 id="s-act" className="mb-3 text-xl">Aktivitas terakhir</h2>
          <Card>
            {activity.length === 0 ? <p className="text-sm text-muted">Belum ada aktivitas.</p> : (
              <ul className="divide-y divide-border text-sm">
                {activity.map((a) => (
                  <li key={String(a._id)} className="flex flex-wrap justify-between gap-2 py-2">
                    <span><span className="font-medium">{a.action}</span> {a.summary ? `: ${a.summary}` : ""}</span>
                    <time className="text-muted" dateTime={new Date(a.at).toISOString()}>{formatDate(a.at, true)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
