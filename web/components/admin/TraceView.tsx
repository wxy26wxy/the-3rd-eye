import { getArtworkTrace } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { ArtImage } from "@/components/ui/ArtImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stack } from "@/components/ui/Layout";
import { Chip, Title } from "@/components/ui/Text";
import styles from "./Admin.module.css";

/** Pipeline order used to sort calls that share a timestamp. */
const STAGE_ORDER = ["transcribe", "shape", "generate", "refine", "describe", "segment", "sticker", "mockup", "listing", "story", "captions"];
const json = (v: unknown) => JSON.stringify(v, null, 2);

export async function TraceView({ params }: { params: Promise<{ artworkId: string }> }) {
  const { artworkId } = await params;
  const trace = await getArtworkTrace(artworkId);
  if (!trace) return <p className={styles.empty}>{m.admin.traceMissing}</p>;
  const { artwork: a } = trace;
  const calls = [...trace.calls].sort((x, y) => (+x.createdAt - +y.createdAt) || (STAGE_ORDER.indexOf(x.stage) - STAGE_ORDER.indexOf(y.stage)));
  return (
    <Stack gap="xxl">
      <Card pad="l" className={styles.traceHead}>
        <div className={styles.traceImg}><ArtImage src={a.cleanedUrl} alt={a.altText ?? ""} placeholder={m.common.imageMissing} /></div>
        <dl className={styles.dl}>
          <dt>{m.admin.traceTranscript}</dt><dd>{a.transcript ?? "—"}</dd>
          <dt>{m.admin.tracePrompt}</dt><dd>{a.shapedPrompt ?? "—"}</dd>
          <dt>{m.admin.traceDescription}</dt><dd>{a.spokenDescription ?? a.altText ?? "—"}</dd>
        </dl>
      </Card>
      <section aria-labelledby="calls-title">
        <Stack gap="l">
          <Title id="calls-title">{m.admin.traceCalls}</Title>
          <ol role="list" className={styles.chain}>
            {calls.map((c) => (
              <li key={c.id} className={styles.call}>
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
              </li>
            ))}
          </ol>
        </Stack>
      </section>
      <div><Button href="/admin" variant="secondary" arrow={false}>{m.admin.backToOrders}</Button></div>
    </Stack>
  );
}
