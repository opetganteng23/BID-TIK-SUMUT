import { assertSameOrigin, ok, route } from "@/lib/http";
import { destroySession } from "@/lib/auth/session";

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  await destroySession();
  return ok({}, requestId);
});
