import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { ComplaintTracker } from "@/components/site/ComplaintTracker";
import { uploadsEnabled } from "@/lib/attachments";

// Halaman pelacakan tidak boleh diindeks maupun membawa kode akses di URL.
export const metadata: Metadata = { title: "Lacak Pengaduan", robots: { index: false, follow: false } };

export default function TrackPage() {
  return (
    <Container className="pb-8 pt-28">
      <h1 className="text-4xl md:text-5xl">Lacak Pengaduan</h1>
      <div className="mt-8 max-w-3xl">
        <ComplaintTracker uploadsEnabled={uploadsEnabled()} />
      </div>
    </Container>
  );
}
