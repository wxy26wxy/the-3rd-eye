import type { ReactNode } from "react";
import { m, fmt } from "@/components/messages";
import { Tag, type TagPose } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Loading } from "@/components/ui/Loading";
import { IconButton } from "@/components/ui/IconButton";
import { BackIcon } from "@/components/ui/Icons";
import { Sheet } from "@/components/ui/Sheet";
import { StepPill } from "@/components/ui/StepPill";
import { Eyebrow, Lead } from "@/components/ui/Text";
import styles from "./Create.module.css";

/**
 * Phone-first frame for every /create screen: back button + step pill, display headline,
 * body, and a cream bottom sheet (scalloped edge) holding the main actions.
 */
export function CreateScreen({ back, step, eyebrow, title, lead, mascot, badge, children, footer }: {
  back?: string; step?: number; eyebrow?: string; title: string; lead?: string; mascot?: TagPose; badge?: ReactNode; children?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        {back ? <IconButton href={back} label={m.common.back}><BackIcon /></IconButton> : <span className={styles.spacer} />}
        {step ? <StepPill step={step} total={3} label={fmt(m.create.step, { n: step, total: 3 })} /> : null}
        <span className={styles.spacer} />
      </div>
      <div className={styles.head}>
        {mascot ? <Tag pose={mascot} decorative className={styles.mascot} /> : null}
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <div className={styles.titleRow}>
          <Display as="h1" size="xl">{title}</Display>
          {badge}
        </div>
        {lead ? <Lead>{lead}</Lead> : null}
      </div>
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <Sheet as="div" className={styles.footer}><div className={styles.footerInner}>{footer}</div></Sheet> : null}
    </div>
  );
}

export function MissingState() {
  return (
    <CreateScreen title={m.create.missingState} mascot="waving" footer={<StartOverButton />} />
  );
}

export function StartOverButton() {
  return <Button href="/create/product" block>{m.common.startOver}</Button>;
}

/** Shown until the sessionStorage draft is available, so screens mount with the real draft. */
export function HydratingScreen({ title }: { title: string }) {
  return <CreateScreen title={title}><Loading label={m.common.loading} /></CreateScreen>;
}
