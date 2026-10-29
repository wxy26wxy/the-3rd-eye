import type { ReactNode } from "react";
import { getArtworkTrace, type AiCallRow, type TraceImage } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { DieCut } from "@/components/site/DieCut";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Stack } from "@/components/ui/Layout";
import { Chip, Title } from "@/components/ui/Text";
import styles from "./Admin.module.css";

const json = (v: unknown) => JSON.stringify(v, null, 2);
const mediaHref = (pathname: string) => (/^https?:|^\//.test(pathname) ? pathname : `/media/${pathname.split("/").map(encodeURIComponent).join("/")}`);
const byTime = (a: AiCallRow, b: AiCallRow) => +a.createdAt - +b.createdAt;

/**
 * The AI chain for one artwork, in pipeline order:
 * transcript → shaped prompt → variants → description → selection → mask → sticker.
 * Each step shows what the artwork rows recorded plus the matching ai_calls.
 */
export async function TraceView({ params }: { params: Promise<{ artworkId: string }> }) {
  const { artworkId } = await params;
  const trace = await getArtworkTrace(artworkId);
  if (!trace) return <p className={styles.empty}>{m.admin.traceMissing}</p>;
  const { artwork: a, variants, candidates } = trace;
  const calls = [...trace.calls].sort(byTime);
  const used = new Set<string>();
  const take = (...stages: string[]) => calls.filter((c) => stages.includes(c.stage) && !used.has(c.id) && used.add(c.id));
  const chosenIndex = variants.findIndex((v) => v.chosen);
  const chosenCandidate = candidates.findIndex((c) => c.chosen);

  const steps: { title: string; calls: AiCallRow[]; body: ReactNode }[] = [
    { title: m.admin.traceTranscript, calls: take("transcribe"), body: a.transcript ? <p>{a.transcript}</p> : null },
    { title: m.admin.tracePrompt, calls: take("shape"), body: a.shapedPrompt ? <p>{a.shapedPrompt}</p> : null },
    {
      title: m.admin.traceVariants,
      calls: take("generate", "refine"),
      body: variants.length ? <ImageRow images={variants} /> : a.originalUrl ? (
        <div className={styles.traceThumb}><ArtImage src={mediaHref(a.originalUrl)} alt={m.admin.traceOriginal} placeholder={m.common.imageMissing} /></div>
      ) : null,
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
      title: m.admin.traceSelection,
      calls: [],
      body: candidates.length ? (
        <>
          <ImageRow images={candidates} />
          <p>{chosenCandidate >= 0 ? fmt(m.admin.traceChosenVariant, { n: chosenCandidate + 1 }) : m.admin.traceNoChoice}</p>
        </>
      ) : variants.length ? <p>{chosenIndex >= 0 ? fmt(m.admin.traceChosenVariant, { n: chosenIndex + 1 }) : m.admin.traceNoChoice}</p> : null,
    },
    {
      title: m.admin.traceMask,
      calls: take("segment"),
      body: a.maskUrl ? (
        <div className={styles.traceThumb}><ArtImage src={mediaHref(a.maskUrl)} alt={m.admin.traceMask} placeholder={m.common.imageMissing} /></div>
      ) : null,
    },
    {
      title: m.admin.traceSticker,
      calls: take("sticker"),
      body: a.cleanedUrl ? (
        <div className={styles.traceThumb}>
          {a.cutPathSvg ? <DieCut artworkUrl={a.cleanedUrl} cutPathSvg={a.cutPathSvg} alt={a.altText ?? ""} /> : <ArtImage src={a.cleanedUrl} alt={a.altText ?? ""} placeholder={m.common.imageMissing} />}
        </div>
      ) : null,
    },
  ];
  const rest = calls.filter((c) => !used.has(c.id));

  return (
    <Stack gap="xxl">
      <ol role="list" className={styles.chain}>
        {steps.map((s, i) => (
          <li key={s.title} className={styles.call}>
            <div className={styles.callHead}>
              <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
              <Title as="h2" size="m"><span className="visually-hidden">{fmt(m.admin.traceStep, { n: i + 1 })}: </span>{s.title}</Title>
            </div>
            {s.body ?? <p className={styles.sub}>{m.admin.traceNone}</p>}
            {s.calls.map((c) => <CallDetails key={c.id} call={c} />)}
          </li>
        ))}
      </ol>
      {rest.length ? (
        <section aria-labelledby="other-calls">
          <Stack gap="l">
            <Title id="other-calls">{m.admin.traceOtherCalls}</Title>
            <ol role="list" className={styles.chain}>{rest.map((c) => <li key={c.id} className={styles.call}><CallDetails call={c} /></li>)}</ol>
          </Stack>
        </section>
      ) : null}
      <div><Button href="/admin" variant="secondary" arrow={false}>{m.admin.backToOrders}</Button></div>
    </Stack>
  );
}

function ImageRow({ images }: { images: TraceImage[] }) {
  return (
    <ul role="list" className={styles.imageRow}>
      {images.map((img) => (
        <li key={img.id} className={img.chosen ? styles.chosen : undefined}>
          <ArtImage src={img.url} alt={img.altText ?? ""} placeholder={m.common.imageMissing} />
          {img.chosen ? <Chip>{m.admin.traceChosen}</Chip> : null}
        </li>
      ))}
    </ul>
  );
}

function CallDetails({ call: c }: { call: AiCallRow }) {
  return (
    <div className={styles.callBlock}>
      <div className={styles.callHead}>
        <Chip>{c.stage}</Chip>
        <span className={styles.mono}>{c.model}</span>
        <span className={styles.sub}>{c.provider}{c.latencyMs != null ? ` · ${fmt(m.admin.traceLatency, { ms: c.latencyMs })}` : ""}</span>
        {c.error ? <span className={styles.error}>{c.error}</span> : null}
      </div>
      <details className={styles.details}>
        <summary>{m.admin.traceRequest}</summary>
        <pre>{json(c.requestJson)}</pre>
      </details>
      <details className={styles.details}>
        <summary>{m.admin.traceResponse}</summary>
        <pre>{json(c.responseJson)}</pre>
      </details>
    </div>
  );
}
