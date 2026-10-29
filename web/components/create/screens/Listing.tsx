"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { m, money } from "@/components/messages";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { SparkleIcon } from "@/components/ui/Icons";
import { Loading, Status } from "@/components/ui/Loading";
import { Title } from "@/components/ui/Text";
import { api, type AgentStep, type ListingDraft, type Product } from "../api";
import { CreateScreen, MissingState } from "../CreateScreen";
import { once, updateDraft, useCreate, useCreator } from "../store";
import styles from "../Create.module.css";

const toDollars = (cents: number) => (cents / 100).toFixed(2);
function toCents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 && /^\$?\s*\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(n * 100) : null;
}

/** Listing: the agent prefills name, description and price; the creator edits and approves. */
export function Listing() {
  const { ready, draft } = useCreate();
  if (!ready) return <CreateScreen back="/create/ready" title={m.create.listing.title}><Loading label={m.common.loading} /></CreateScreen>;
  if (!draft.productRecord) return <MissingState />;
  return <ListingForm />;
}

function ListingForm() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { creator } = useCreator();
  const traceId = useId();
  const p = draft.productRecord;
  const [title, setTitle] = useState(draft.listing?.title ?? "");
  const [description, setDescription] = useState(draft.listing?.description ?? "");
  const [price, setPrice] = useState(draft.listing ? toDollars(draft.listing.price_cents) : p ? toDollars(p.priceCents) : "");
  const [running, setRunning] = useState(!draft.listing);
  const [showTrace, setShowTrace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  function apply(l: ListingDraft) {
    setTitle(l.title);
    setDescription(l.description);
    setPrice(toDollars(l.price_cents));
  }
  /** Calls the listing agent; state changes happen only after the request settles. */
  function fetchAgent(key: string) {
    if (!p) return Promise.resolve();
    return once(key, () => api<{ listing: ListingDraft; trace: AgentStep[] }>(`listings/${p.id}/run`, { method: "POST", json: {} }))
      .then((res) => { update({ listing: res.listing, trace: res.trace }); apply(res.listing); })
      .catch(() => setError(m.create.errorGeneric))
      .finally(() => setRunning(false));
  }
  function improve() {
    setRunning(true);
    setError(null);
    void fetchAgent(`listing:${p?.id}:${Date.now()}`);
  }
  const productId = p?.id;
  const hasListing = !!draft.listing;
  useEffect(() => {
    // First visit: prefill from the agent once per product.
    if (ready && productId && !hasListing) void fetchAgent(`listing:${productId}:first`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAgent is recreated each render; run once per product
  }, [ready, productId, hasListing]);

  const cents = toCents(price);
  const bps = creator?.split?.creator_bps ?? 5000;
  const earn = cents ? Math.floor((cents * bps) / 10000) : null;
  const printOk = draft.listing?.print_ok;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    const errs = { title: title.trim() ? undefined : m.create.listing.nameRequired, price: cents ? undefined : m.create.listing.priceInvalid };
    setErrors(errs);
    if (errs.title || errs.price) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ product: Product; storyVideoNeeded: boolean }>(`listings/${p.id}/approve`, {
        json: { approvedVia: "tap", edits: { title: title.trim(), description: description.trim(), priceCents: cents } },
      });
      updateDraft({ productRecord: res.product, listingTitle: title.trim(), storyVideoNeeded: res.storyVideoNeeded });
      router.push(res.storyVideoNeeded ? "/create/story-video" : "/create/live");
    } catch {
      setError(m.create.errorGeneric);
      setSubmitting(false);
    }
  }

  return (
    <CreateScreen back="/create/ready" title={m.create.listing.title}>
      {running && !draft.listing ? <Loading label={m.create.listing.drafting} /> : null}
      <form onSubmit={submit} className={styles.said} noValidate>
        <Field label={m.create.listing.name} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} required maxLength={80} />
        <Field label={m.create.listing.description} multiline rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        <Field label={m.create.listing.price} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" error={errors.price} required />
        <p className={styles.earn} aria-live="polite">
          <span>{m.create.listing.earn}</span>
          <span className={styles.earnValue}>{earn != null ? money(earn) : "—"}</span>
        </p>
        {printOk !== undefined ? <Status tone={printOk ? "success" : "info"}>{m.create.listing.printCheck.replace("{status}", printOk ? m.create.listing.printOk : m.create.listing.printWarn)}</Status> : null}
        <Button variant="secondary" arrow={false} icon={<SparkleIcon />} onClick={improve} disabled={running}>
          {running ? m.create.listing.improving : m.create.listing.improve}
        </Button>
        {draft.trace?.length ? (
          <>
            <Button variant="ghost" arrow={false} aria-expanded={showTrace} aria-controls={traceId} onClick={() => setShowTrace((s) => !s)}>
              {showTrace ? m.create.listing.hideTrace : m.create.listing.showTrace}
            </Button>
            <Card id={traceId} pad="m" tone="white" hidden={!showTrace}>
              <Title as="h2" size="m">{m.create.listing.traceTitle}</Title>
              <ol role="list" className={styles.trace}>
                {draft.trace.map((s, i) => (
                  <li key={i}>
                    <span className={styles.traceTool}>{s.step}. {s.tool ?? "note"}</span>{" "}
                    {s.text ?? (s.result !== undefined ? JSON.stringify(s.result) : s.args !== undefined ? JSON.stringify(s.args) : "")}
                  </li>
                ))}
              </ol>
            </Card>
          </>
        ) : null}
        {error ? <Status tone="error">{error}</Status> : null}
        <Button type="submit" block disabled={submitting || running}>{submitting ? m.create.listing.submitting : m.create.listing.submit}</Button>
      </form>
    </CreateScreen>
  );
}
