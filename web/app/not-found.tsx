import { m } from "@/components/messages";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Container } from "@/components/ui/Layout";
import { SkyCard } from "@/components/ui/Loading";
import styles from "@/components/pages/Pages.module.css";

/** 404 · Sky (board 2025:2886): site nav and footer, the sky picture (decorative), title, line, Go to the shop. */
export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main" tabIndex={-1}>
        <Container className={styles.notFound}>
          <SkyCard className={styles.notFoundSky} />
          <Display as="h1" size="web">{m.notFound.title}</Display>
          <p className={styles.notFoundCopy}>{m.notFound.copy}</p>
          <Button href="/">{m.notFound.home}</Button>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
