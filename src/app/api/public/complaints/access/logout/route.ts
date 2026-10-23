import { assertSameOrigin, ok, route } from "@/lib/http";
import { endReporterSession } from "@/lib/complaint-service";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  await endReporterSession();
  return ok({}, requestId);
});
