import { redirect } from "next/navigation";

/** v0.8: the old Select screen; round 3/4: Adjust the area (the frame, cropped on the device), then Your cutout. */
export default function Page() {
  redirect("/create/adjust");
}
