import { Mascot, type MascotPose } from "@/components/ui/Mascot";

export type TagPose = "listening" | "cheering" | "waving";

/**
 * Old pose names → Sky mascot photos. No waving cut-out exists yet, and the front pose is a low-resolution
 * source (204 px) that posterises on 2x screens, so every pose uses the reading mascot until the designer
 * sends larger sources.
 */
const POSE: Record<TagPose, MascotPose> = { listening: "book", cheering: "book", waving: "book" };

/**
 * The mascot. Kept as a thin wrapper over `ui/Mascot` so call sites keep their pose names.
 * Pass `decorative` when nearby text already says what is happening.
 */
export function Tag({ pose = "waving", decorative = false, eager, className }: { pose?: TagPose; decorative?: boolean; eager?: boolean; className?: string }) {
  return <Mascot pose={POSE[pose]} decorative={decorative} eager={eager} className={className} />;
}
