import { redirect } from "next/navigation";

/** v0.8: the old Select screen; round 3: Adjust the area (detection inside the frame), then Your cutout. */
export default function Page() {
  redirect("/create/adjust");
}
