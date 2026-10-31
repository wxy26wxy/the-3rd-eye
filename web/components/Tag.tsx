import { Mascot, type MascotPose } from "@/components/ui/Mascot";

export type TagPose = "listening" | "cheering" | "waving";

/**
 * Old pose names → Sky mascot photos. No waving cut-out exists yet, and the front pose is a low-resolution
 * source (204 px), so waving and cheering use the reading pose until the designer sends a waving PNG.
 */
const POSE: Record<TagPose, MascotPose> = { listening: "front", cheering: "book", waving: "book" };

/**
 * The mascot. Kept as a thin wrapper over `ui/Mascot` so call sites keep their pose names.
 * Pass `decorative` when nearby text already says what is happening.
 */
export function Tag({ pose = "waving", decorative = false, className }: { pose?: TagPose; decorative?: boolean; className?: string }) {
  return <Mascot pose={POSE[pose]} decorative={decorative} className={className} />;
}
