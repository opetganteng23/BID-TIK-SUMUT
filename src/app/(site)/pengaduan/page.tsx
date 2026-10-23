import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, Notice } from "@/components/ui";
import { ComplaintForm } from "@/components/site/ComplaintForm";
import { connectDb } from "@/lib/db";
import { ComplaintCategory } from "@/lib/models";
import { uploadsEnabled } from "@/lib/attachments";

export const metadata: Metadata = { title: "Ajukan Pengaduan", alternates: { canonical: "/pengaduan" } };

export default async function ComplaintPage() {
  await connectDb();
  const cats = await ComplaintCategory.find({ active: true }, "name").sort({ order: 1 }).lean();
  return (
    <Container className="pb-8 pt-28">
      <h1 className="text-4xl md:text-5xl">Ajukan Pengaduan</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Tidak perlu membuat akun. Setelah mengirim, Anda menerima nomor tiket dan kode akses rahasia untuk memantau tindak lanjut. Sudah punya tiket?{" "}
        <Link href="/pengaduan/lacak" className="font-medium underline underline-offset-4">Lacak pengaduan</Link>.
      </p>
      <div className="mt-6 max-w-2xl">
        <Notice kind="info">
          Versi prototype. Gunakan <strong>data fiktif</strong> untuk pengujian. Jangan memasukkan data pribadi atau pengaduan yang sebenarnya.
        </Notice>
      </div>
      <Card className="mt-8 max-w-2xl">
        <ComplaintForm categories={cats.map((c) => ({ id: String(c._id), name: c.name }))} uploadsEnabled={uploadsEnabled()} />
      </Card>
    </Container>
  );
}
