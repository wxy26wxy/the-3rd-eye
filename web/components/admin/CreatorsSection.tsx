import { listAdminCreators } from "@/lib/db/queries.contract";
import { CreatorsPanel } from "./CreatorsPanel";

/** Admin "Creators" section (T070): the studio adds creators and issues their sign-in codes. */
export async function CreatorsSection() {
  const creators = await listAdminCreators();
  return <CreatorsPanel creators={creators} />;
}
