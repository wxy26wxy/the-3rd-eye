import { requireCreator } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getCreatorById, listArtworksByCreator } from "@/lib/db/queries";

/** Three talking points for the story video, personalised with the creator's latest artwork. */
export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const [creator, artworks] = await Promise.all([getCreatorById(creatorId), listArtworksByCreator(creatorId)]);
  const latest = artworks.find((a) => a.status === "ready");
  const piece = latest?.altText ? `your ${latest.altText.replace(/\.$/, "").toLowerCase()}` : "this piece";
  return json({
    prompts: [
      `Say hi! Tell buyers your name${creator?.studioName ? ` and that you make art at ${creator.studioName}` : ""}.`,
      `What is ${piece} about, and what made you want to make it?`,
      "What do you love most about making art?",
    ],
  });
});
