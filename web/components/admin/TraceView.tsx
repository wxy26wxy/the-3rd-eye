import { Fragment, type ReactNode } from "react";
import { getArtworkTrace, type AiCallRow, type TraceImage } from "@/lib/db/queries.contract";
import { KEEP_GUARD } from "@/lib/ai/guard";
import { fmt, m } from "@/components/messages";
import { DieCut } from "@/components/site/DieCut";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Stack } from "@/components/ui/Layout";
import { ChevronRightIcon } from "@/components/ui/Icons";
import { Chip } from "@/components/ui/Text";
import styles from "./Admin.module.css";

const json = (v: unknown) => JSON.stringify(v, null, 2);
const mediaHref = (pathname: string) => (/^https?:|^\//.test(pathname) ? pathname : `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`);
const byTime = (a: AiCallRow, b: AiCallRow) => +a.createdAt - +b.createdAt;

/**
 * The AI chain for one artwork, in the v0.8 (photo-first) order (board 2034:3995):
 * Photo and mask → Change request → Edit instruction → Before and after → Description → Decision → Sticker.
 * Each step shows what the artwork rows recorded plus the matching ai_calls. Text-to-image rows
 * (not made by the apps since v0.8) show their transcript, shaped prompt and variants in the same steps.
 */
export async function TraceView({ params }: { params: Promise<{ artworkId: string }> }) {
  const { artworkId } = await params;
  const trace = await getArtworkTrace(artworkId);
  if (!trace) return <MissingTrace />;
  const { artwork: a, variants, candidates, photo, changes } = trace;
  const calls = [...trace.calls].sort(byTime);
  const used = new Set<string>();
  const take = (...stages: string[]) => calls.filter((c) => stages.includes(c.stage) && !used.has(c.id) && used.add(c.id));
  const chosenIndex = variants.findIndex((v) => v.chosen);
  const chosenCandidate = candidates.findIndex((c) => c.chosen);
  const said = a.transcript && !changes.length ? a.transcript : null;

  const steps: { title: string; calls: AiCallRow[]; body: ReactNode }[] = [
    {
      title: m.admin.traceStepPhoto,
      calls: take("segment"),
      body: photo.originalUrl || photo.maskUrl || candidates.length ? (
        <>
          <ImageRow images={[
            ...(photo.originalUrl ? [{ id: "original", url: mediaHref(photo.originalUrl), altText: m.admin.traceOriginal, chosen: false, label: m.admin.traceOriginal }] : []),
            ...(photo.maskUrl ? [{ id: "mask", url: mediaHref(photo.maskUrl), altText: m.admin.traceMask, chosen: false, label: m.admin.traceMask }] : []),
            ...candidates,
          ]} />
          {photo.maskUrl ? <a href={mediaHref(photo.maskUrl)} className={styles.link}>{m.admin.traceOpenMask}</a> : null}
        </>
      ) : null,
    },
    {
      title: m.admin.traceStepChange,
      calls: take("transcribe", "shape"),
      body: changes.length || said || a.shapedPrompt ? (
        <dl className={styles.dl}>
          {changes.map((c, i) => (
            <Fragment key={c.id}>
              {c.transcript ? <><dt>{m.admin.traceSaid}{changes.length > 1 ? ` ${i + 1}` : ""}</dt><dd>{c.transcript}</dd></> : null}
              <dt>{m.admin.traceTyped}{changes.length > 1 ? ` ${i + 1}` : ""}</dt><dd>{c.instruction}</dd>
            </Fragment>
          ))}
          {said ? <><dt>{m.admin.traceTranscript}</dt><dd>{said}</dd></> : null}
          {a.shapedPrompt ? <><dt>{m.admin.tracePrompt}</dt><dd>{a.shapedPrompt}</dd></> : null}
        </dl>
      ) : null,
    },
    {
      title: m.admin.traceStepEdit,
      calls: take("edit", "generate", "refine"),
      body: changes.length ? (
        <dl className={styles.dl}>
          {changes.map((c, i) => <Fragment key={c.id}><dt>{fmt(m.admin.traceStep, { n: i + 1 })}</dt><dd>{c.instruction}</dd></Fragment>)}
          <dt>{m.admin.traceGuard}</dt><dd>{KEEP_GUARD}</dd>
        </dl>
      ) : null,
    },
    {
      title: m.admin.traceStepBeforeAfter,
      calls: [],
      body: changes.length ? (
        <ImageRow images={changes.flatMap((c, i) => {
          const n = changes.length > 1 ? ` ${i + 1}` : "";
          return [
            { id: `${c.id}-before`, url: c.beforeUrl, altText: m.admin.traceBefore, chosen: false, label: `${m.admin.traceBefore}${n}` },
            { id: `${c.id}-after`, url: c.afterUrl, altText: m.admin.traceAfter, chosen: false, label: `${m.admin.traceAfter}${n}` },
          ];
        })} />
      ) : variants.length ? <ImageRow images={variants.map((v, i) => ({ ...v, label: fmt(m.create.result.variant, { n: i + 1 }) }))} /> : null,
    },
    {
      title: m.admin.traceDescription,
      calls: take("describe"),
      body: a.spokenDescription || a.altText ? (
        <dl className={styles.dl}>
          <dt>{m.admin.traceDescription}</dt><dd>{a.spokenDescription ?? a.altText}</dd>
          {a.differencesFromPrompt ? <><dt>{m.admin.traceDifferences}</dt><dd>{a.differencesFromPrompt}</dd></> : null}
        </dl>
      ) : null,
    },
    {
      title: m.admin.traceStepDecision,
      calls: [],
      body: candidates.length ? (
        <p>
          {chosenCandidate >= 0 ? fmt(m.admin.traceChosenVariant, { n: chosenCandidate + 1 }) : m.admin.traceNoChoice}
          {!changes.length && a.source !== "text2image" ? ` ${m.admin.traceKeptOriginal}` : ""}
        </p>
      ) : variants.length ? <p>{chosenIndex >= 0 ? fmt(m.admin.traceChosenVariant, { n: chosenIndex + 1 }) : m.admin.traceNoChoice}</p> : null,
    },
    {
      title: m.admin.traceSticker,
      calls: take("sticker"),
      body: a.cleanedUrl ? (
        a.cutPathSvg
          ? <div className={styles.stickerCut}><DieCut artworkUrl={a.cleanedUrl} cutPathSvg={a.cutPathSvg} alt={a.altText ?? ""} /></div>
          : <ImageRow images={[{ id: "sticker", url: a.cleanedUrl, altText: a.altText, chosen: false, label: m.admin.traceSticker }]} />
      ) : null,
    },
  ];
  const rest = calls.filter((c) => !used.has(c.id));

  return (
    <Stack gap="xxl">
      <ol role="list" className={styles.chain}>
        {steps.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <h2 className={styles.stepTitle}><span className="visually-hidden">{fmt(m.admin.traceStep, { n: i + 1 })}: </span>{s.title}</h2>
            {s.body ?? <p className={styles.sub}>{m.admin.traceNone}</p>}
            {s.calls.map((c) => <CallDetails key={c.id} call={c} />)}
          </li>
        ))}
      </ol>
      {rest.length ? (
        <section aria-labelledby="other-calls">
          <Stack gap="m">
            <h2 id="other-calls" className={styles.otherTitle}>{m.admin.traceOtherCalls}</h2>
            <ol role="list" className={styles.chain}>{rest.map((c) => <li key={c.id}><CallDetails call={c} /></li>)}</ol>
          </Stack>
        </section>
      ) : null}
      <div><Button href="/admin" variant="secondary" arrow={false}>{m.admin.backToOrders}</Button></div>
    </Stack>
  );
}

type Thumb = TraceImage & { label?: string };

/** Thumbnails (90 px) with their label under each; the chosen one gets the ink border and the Chosen chip. */
function ImageRow({ images }: { images: Thumb[] }) {
  return (
    <ul role="list" className={styles.imageRow}>
      {images.map((img) => (
        <li key={img.id} className={img.chosen ? styles.chosen : undefined}>
          <ArtImage className={styles.thumb} src={img.url} alt={img.altText ?? img.label ?? ""} placeholder={m.common.imageMissing} />
          {img.label || img.chosen ? (
            <span className={styles.thumbLabel}>{img.label}{img.chosen ? <Chip>{m.admin.traceChosen}</Chip> : null}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** One model call: "stage · model · provider · ms", then Request / Response disclosures side by side. */
function CallDetails({ call: c }: { call: AiCallRow }) {
  return (
    <div className={styles.callBlock}>
      <p className={styles.callHead}>
        <span>{[c.stage, c.model, c.provider, c.latencyMs != null ? fmt(m.admin.traceLatency, { ms: c.latencyMs }) : null].filter(Boolean).join(m.common.listSeparator)}</span>
        {c.error ? <span className={styles.error}>{c.error}</span> : null}
      </p>
      <div className={styles.disclosures}>
        <details className={styles.details}>
          <summary><ChevronRightIcon size="1rem" /><span>{m.admin.traceRequest}</span></summary>
          <pre>{json(c.requestJson)}</pre>
        </details>
        <details className={styles.details}>
          <summary><ChevronRightIcon size="1rem" /><span>{m.admin.traceResponse}</span></summary>
          <pre>{json(c.responseJson)}</pre>
        </details>
      </div>
    </div>
  );
}

/** AI trace · Missing (board 2034:4158): the grey empty card and the way back. */
function MissingTrace() {
  return (
    <Stack gap="xxl">
      <p className={styles.empty}>{m.admin.traceMissing}</p>
      <div><Button href="/admin" variant="secondary" arrow={false}>{m.admin.backToOrders}</Button></div>
    </Stack>
  );
}
