import type { ReactNode } from "react";
import { m, fmt } from "@/components/messages";
import { Tag, type TagPose } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Loading } from "@/components/ui/Loading";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/LogoMark";
import { StepPill } from "@/components/ui/StepPill";
import { Eyebrow, Lead } from "@/components/ui/Text";
import styles from "./Create.module.css";

/**
 * Phone-first frame for every /create screen (Sky, Pick board `45:700`): white page, the logo mark
 * top-left (or a 44 px Back chevron in its place when the screen has a back action), 48 px headline,
 * body, and a bottom action bar holding the main actions (56 px primary, 50 px secondary).
 * The step is announced to assistive technology only.
 */
export function CreateScreen({ back, step, eyebrow, title, lead, mascot, badge, children, footer }: {
  back?: string; step?: number; eyebrow?: string; title: string; lead?: string; mascot?: TagPose; badge?: ReactNode; children?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        {back ? <IconButton href={back} label={m.common.back} size="s"><ChevronLeftIcon /></IconButton> : <LogoMark />}
        {step ? <StepPill step={step} total={3} label={fmt(m.create.step, { n: step, total: 3 })} /> : null}
      </div>
      <div className={styles.head}>
        {mascot ? <Tag pose={mascot} decorative eager className={styles.mascot} /> : null}
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <div className={styles.titleRow}>
          <Display as="h1" size="xl">{title}</Display>
          {badge}
        </div>
        {lead ? <Lead>{lead}</Lead> : null}
      </div>
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <div className={styles.footer}><div className={styles.footerInner}>{footer}</div></div> : null}
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
