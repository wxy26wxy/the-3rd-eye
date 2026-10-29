import { getTagThankYouCaptions } from "@/lib/db/queries.contract";

/** WebVTT captions for the thank-you video of one order, scoped by its story-tag token (used by <track>). */
export async function GET(_req: Request, ctx: RouteContext<"/captions/tag/[token]">) {
  const { token } = await ctx.params;
  const vtt = await getTagThankYouCaptions(token);
  if (!vtt) return new Response("WEBVTT\n\n", { status: 404, headers: { "content-type": "text/vtt; charset=utf-8" } });
  return new Response(vtt, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=300" } });
}
