import { redirect } from "next/navigation";

/** Voice-only creation was removed in v0.8 (photo first): old links land on Choose method. */
export default function Page() {
  redirect("/create/method");
}
