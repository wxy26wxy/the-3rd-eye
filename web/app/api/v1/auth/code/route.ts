import { z } from "zod";
import { CREATOR_COOKIE, signCreatorToken } from "@/lib/auth";
import { ApiError, json, parseJson, route } from "@/lib/http";
import { getCreatorByLoginCode } from "@/lib/db/queries";
import { toCreator } from "@/lib/api/dto";

const Body = z.object({ code: z.string().trim().min(1).max(64) });

/** Dev-mode sign in with a creator code. Also sets the creator cookie for the mobile web flow. */
export const POST = route(async (req) => {
  const { code } = await parseJson(req, Body);
  const creator = await getCreatorByLoginCode(code);
  if (!creator) throw new ApiError(401, "invalid_code", "That code did not work. Check it and try again.");
  const token = signCreatorToken(creator.id);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return json({ token, creator: toCreator(creator) }, 200, {
    "Set-Cookie": `${CREATOR_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  });
});
