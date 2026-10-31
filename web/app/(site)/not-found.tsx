import { NotFoundBody } from "@/components/pages/NotFoundBody";

/** notFound() from a (site) page (/p/<id>, /c/<slug>): the (site) layout already draws the nav, main and footer. */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
