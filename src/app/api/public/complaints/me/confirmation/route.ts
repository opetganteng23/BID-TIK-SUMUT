import { assertSameOrigin, ok, readJson, route } from "@/lib/http";
import { applyTransition, requireReporter } from "@/lib/complaint-service";
import { confirmationSchema } from "@/lib/complaint-schemas";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const id = await requireReporter();
  const input = await readJson(req, confirmationSchema, 5_000);
  // Transisi atomik: bila job auto-close sudah menutup tiket, aksi ini ditolak dengan CONFLICT.
  const updated = input.resolved
    ? await applyTransition({ complaintId: id, to: "closed", actor: "reporter", closureReason: "reporter_confirmed", note: input.note })
    : await applyTransition({ complaintId: id, to: "in_progress", actor: "reporter", note: input.note ?? "Pelapor menyatakan belum selesai" });
  return ok({ status: updated.status }, requestId);
});
