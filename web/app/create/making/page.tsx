import { redirect } from "next/navigation";

/** Round 4 ruling 2: the Making screen is gone; the sticker / tote bag is made on Change it (its making state). */
export default function Page() {
  redirect("/create/change");
}
