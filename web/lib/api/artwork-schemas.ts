/** Request bodies for the artwork adjust routes (kept here so tests can validate them; see docs/api.md T080). */
import { z } from "zod";

const coord = z.number().finite().min(0);
export const CleanupPoint = z.object({ x: coord, y: coord, label: z.enum(["positive", "negative"]).default("positive") });

/** `[x0, y0, x1, y1]` in pixels of `imageSize`, non-negative, x0 < x1 and y0 < y1 (clamped to the image by the pipeline). */
export const Box = z.tuple([coord, coord, coord, coord])
  .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1, "box must be [x0, y0, x1, y1] with x0 < x1 and y0 < y1");

/** T134 `POST /artworks/{id}/detect`: the Adjust the area frame. */
export const DetectBody = z.object({ box: Box }).strict();
export type DetectBody = z.infer<typeof DetectBody>;

export const CleanupBody = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(6).optional(),
  points: z.array(CleanupPoint).min(1).max(10).optional(),
  box: z.tuple([coord, coord, coord, coord])
    .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1, "box must be [x0, y0, x1, y1] with x0 < x1 and y0 < y1").optional(),
  /** T126: cut the result to `box` (the "Adjust the area" frame). Needs `box`. */
  clipToBox: z.boolean().optional(),
})
  .refine((b) => b.candidateIds || b.points || b.box, "Give candidateIds, points or a box")
  .refine((b) => !b.points || b.box || b.candidateIds || b.points.some((p) => p.label === "positive"),
    "Negative points need candidateIds or a box to take away from; or add a positive point")
  .refine((b) => !b.clipToBox || b.box, "clipToBox needs a box");
export type CleanupBody = z.infer<typeof CleanupBody>;
