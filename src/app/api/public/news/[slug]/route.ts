import { ApiError, ok, route } from "@/lib/http";
import { getNewsBySlug } from "@/lib/public-data";

export const GET = route(async ({ ctx, requestId }) => {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,96}$/.test(slug)) throw new ApiError("NOT_FOUND");
  const news = await getNewsBySlug(slug);
  if (!news) throw new ApiError("NOT_FOUND");
  return ok(news, requestId);
});
