import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ApiError, assertSameOrigin, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { MEDIA_RULES, type MediaKind } from "@/lib/media";

export const maxDuration = 30;

/** Menerbitkan token client upload ke Vercel Blob setelah memvalidasi peran, tipe, dan ukuran. */
export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("media.upload");
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      let kind: MediaKind;
      try {
        kind = (JSON.parse(clientPayload ?? "{}") as { kind?: MediaKind }).kind ?? "image";
      } catch {
        throw new ApiError("VALIDATION_ERROR");
      }
      const rule = MEDIA_RULES[kind];
      if (!rule) throw new ApiError("VALIDATION_ERROR");
      return {
        allowedContentTypes: rule.mimes,
        maximumSizeInBytes: rule.maxBytes,
        addRandomSuffix: true, // nama berkas diacak
        tokenPayload: JSON.stringify({ userId: user.id, kind }),
      };
    },
    // Pencatatan metadata dilakukan lewat POST /api/admin/media setelah magic bytes diverifikasi.
    onUploadCompleted: async () => {},
  });
  return ok(result, requestId);
});
