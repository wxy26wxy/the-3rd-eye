import { redirect } from "next/navigation";

/** v0.8: picking a piece is Choose a pattern; its cutout tools moved to Your cutout. */
export default function Page() {
  redirect("/create/pattern");
}
