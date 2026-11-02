import type { ReactNode } from "react";
import { m, fmt } from "@/components/messages";
import { Tag, type TagPose } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/LogoMark";
import { StepPill } from "@/components/ui/StepPill";
import { Eyebrow, Lead } from "@/components/ui/Text";
import { PinnedBar } from "./PinnedBar";
import { ScreenTitle } from "./ScreenTitle";
import styles from "./Create.module.css";

/**
 * Phone-first frame for every /create screen (Sky, web creator boards, Figma section `2026:2864`):
 * the logo mark top-left, or a 44 px Back chevron in its place when the screen has a back action;
 * 48 px headline (centred on the celebration screens); muted lead; body with 20 px gaps and 24 px
 * gutters; and a bottom action bar pinned to the bottom (white, 1 px top border) holding the main
 * actions (56 px primary, 50 px secondary). The step is announced to assistive technology only.
 */
export function CreateScreen({ back, bare, step, eyebrow, title, lead, mascot, badge, align = "start", children, footer }: {
  back?: string; step?: number; eyebrow?: string; title: string; lead?: ReactNode; mascot?: TagPose; badge?: ReactNode;
  /** Busy screens (Making your cutout / sticker): an empty top bar, neither logo nor Back. */
  bare?: boolean;
  align?: "start" | "center"; children?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.top}>
          {bare ? null : back ? <IconButton href={back} label={m.common.back} size="s"><ChevronLeftIcon /></IconButton> : <LogoMark />}
          {step ? <StepPill step={step} total={3} label={fmt(m.create.step, { n: step, total: 3 })} /> : null}
        </div>
        <div className={[styles.head, align === "center" ? styles.headCenter : ""].filter(Boolean).join(" ")}>
          {mascot ? <Tag pose={mascot} decorative eager className={styles.mascot} /> : null}
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <ScreenTitle badge={badge}>{title}</ScreenTitle>
          {lead ? <Lead>{lead}</Lead> : null}
        </div>
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
      {footer ? <PinnedBar>{footer}</PinnedBar> : null}
    </div>
  );
}

export function MissingState() {
  return (
    <CreateScreen title={m.create.missingState} footer={<StartOverButton />} />
  );
}

export function StartOverButton() {
  return <Button href="/create/product" block>{m.common.startOver}</Button>;
}

/** Shown until the sessionStorage draft is available, so screens mount with the real draft. */
export function HydratingScreen({ title, back }: { title: string; back?: string }) {
  return <CreateScreen title={title} back={back}><Loading label={m.common.loading} /></CreateScreen>;
}
