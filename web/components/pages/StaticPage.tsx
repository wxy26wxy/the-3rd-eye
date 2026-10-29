import type { ReactNode } from "react";
import { Tag, type TagPose } from "@/components/Tag";
import { Card } from "@/components/ui/Card";
import { Display } from "@/components/ui/Display";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Lead } from "@/components/ui/Text";
import styles from "./Pages.module.css";

/** Short, honest static page: headline, intro, a bullet card, optional footer note. */
export function StaticPage({ title, intro, items, note, pose = "waving", children, itemsId }: {
  title: string; intro: string; items: string[]; note?: string; pose?: TagPose; children?: ReactNode; itemsId?: string;
}) {
  return (
    <Container width="narrow">
      <Section>
        <Stack gap="xxl">
          <div className={styles.staticHead}>
            <Tag pose={pose} decorative className={styles.mascot} />
            <Display as="h1" size="xl">{title}</Display>
            <Lead>{intro}</Lead>
          </div>
          <Card pad="l" className={styles.prose} id={itemsId}>
            <ul role="list">{items.map((t) => <li key={t}>{t}</li>)}</ul>
          </Card>
          {children}
          {note ? <Lead>{note}</Lead> : null}
        </Stack>
      </Section>
    </Container>
  );
}
