import { m } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Container } from "@/components/ui/Layout";
import { SkyCard } from "@/components/ui/Loading";
import styles from "./Pages.module.css";

/** 404 body (board 2025:2886): sky picture (decorative), title, line, Go to the shop. No nav, main or footer: the caller's frame supplies them. */
export function NotFoundBody() {
  return (
    <Container className={styles.notFound}>
      <SkyCard className={styles.notFoundSky} />
      <Display as="h1" size="web">{m.notFound.title}</Display>
      <p className={styles.notFoundCopy}>{m.notFound.copy}</p>
      <Button href="/">{m.notFound.home}</Button>
    </Container>
  );
}
