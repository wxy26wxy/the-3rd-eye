import { NotFoundBody } from "@/components/pages/NotFoundBody";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";

/**
 * 404 for URLs outside every layout (board 2025:2886): the root layout has no nav or footer, so this
 * adds them around the body. Pages under (site) use app/(site)/not-found.tsx, which is the body only.
 */
export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main" tabIndex={-1}><NotFoundBody /></main>
      <SiteFooter />
    </>
  );
}
