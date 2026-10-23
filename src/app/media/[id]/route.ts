import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Media } from "@/lib/models";

// Melayani gambar yang tersimpan sebagai base64. Hanya tipe gambar allowlist yang pernah lolos validasi unggah.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id) || String(new Types.ObjectId(id)) !== id) return new Response("Not found", { status: 404 });
  await connectDb();
  const m = await Media.findById(id, "mime data").select("+data").lean();
  if (!m?.data || !m.mime) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m.data, "base64")), {
    headers: {
      "content-type": m.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
