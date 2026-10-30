/** Request bodies for the artwork adjust routes (kept here so tests can validate them; see docs/api.md T080). */
import { z } from "zod";

const coord = z.number().finite().min(0);
export const CleanupPoint = z.object({ x: coord, y: coord, label: z.enum(["positive", "negative"]).default("positive") });

export const CleanupBody = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(6).optional(),
  points: z.array(CleanupPoint).min(1).max(10).optional(),
  box: z.tuple([coord, coord, coord, coord])
    .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1, "box must be [x0, y0, x1, y1] with x0 < x1 and y0 < y1").optional(),
})
  .refine((b) => b.candidateIds || b.points || b.box, "Give candidateIds, points or a box")
  .refine((b) => !b.points || b.box || b.candidateIds || b.points.some((p) => p.label === "positive"),
    "Negative points need candidateIds or a box to take away from; or add a positive point");
export type CleanupBody = z.infer<typeof CleanupBody>;
