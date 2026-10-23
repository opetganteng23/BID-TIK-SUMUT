import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";

export const GET = route(async ({ requestId }) => {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  return ok({ user }, requestId);
});
