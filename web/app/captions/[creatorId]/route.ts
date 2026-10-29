import { getCreatorCaptions } from "@/lib/db/queries.contract";

/** WebVTT captions for a creator's story video (used by <track>). */
export async function GET(_req: Request, ctx: RouteContext<"/captions/[creatorId]">) {
  const { creatorId } = await ctx.params;
  const vtt = await getCreatorCaptions(creatorId);
  if (!vtt) return new Response("WEBVTT\n\n", { status: 404, headers: { "content-type": "text/vtt; charset=utf-8" } });
  return new Response(vtt, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=300" } });
}
