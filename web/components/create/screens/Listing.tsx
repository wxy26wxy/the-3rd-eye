"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fmt, m } from "@/components/messages";
import { api, uuid, type AgentStep, type ListingDraft, type Product } from "../api";
import { HydratingScreen, MissingState } from "../CreateScreen";
import { describeError, type ScreenError } from "../errors";
import { canRedoListing, redoCutout, redoListing } from "../flow";
import { cutoutOf, getDraft, once, pictureOf, updateDraft, useCreate, useCreator } from "../store";
import { ListingView } from "./ListingView";

const toDollars = (cents: number) => (cents / 100).toFixed(2);
function toCents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 && /^\$?\s*\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(n * 100) : null;
}

/** Listing: the agent prefills name, description and price; the creator edits and approves. */
export function Listing() {
  const { ready, draft } = useCreate();
  if (!ready) return <HydratingScreen back="/create/ready" title={m.create.listing.title} />;
  if (!draft.productRecord) return <MissingState />;
  return <ListingForm />;
}

function ListingForm() {
  const router = useRouter();
  const { ready, draft, update } = useCreate();
  const { creator } = useCreator();
  const uid = useId();
  const p = draft.productRecord;
  const [title, setTitle] = useState(draft.listing?.title ?? "");
  const [description, setDescription] = useState(draft.listing?.description ?? "");
  const [price, setPrice] = useState(draft.listing ? toDollars(draft.listing.price_cents) : p ? toDollars(p.priceCents) : "");
  const [running, setRunning] = useState(!draft.listing);
  const [showTrace, setShowTrace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Which call failed last, so "Try again" repeats that one (approve vs. the listing agent). */
  const [failedCall, setFailedCall] = useState<"agent" | "approve">("agent");
  const [error, setError] = useState<ScreenError | null>(null);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  function apply(l: ListingDraft) {
    setTitle(l.title);
    setDescription(l.description);
    setPrice(toDollars(l.price_cents));
  }
  /**
   * Calls the listing agent for run `run` (the draft's `listingRun`); state changes happen only after
   * the request settles, and only while that run is still the draft's (Redo drops it, ruling 5).
   */
  function fetchAgent(run: string) {
    if (!p) return Promise.resolve();
    const current = () => getDraft().listingRun === run;
    return once(`listing:${p.id}:${run}`, () => api<{ listing: ListingDraft; trace: AgentStep[] }>(`listings/${p.id}/run`, { method: "POST", json: {} }))
      .then((res) => { if (!current()) return; update({ listing: res.listing, trace: res.trace }); apply(res.listing); })
      .catch((err) => { if (!current()) return; setFailedCall("agent"); setError(describeError(err)); })
      .finally(() => { if (current()) setRunning(false); });
  }
  /** A new run (Improve with AI, Try again): a new nonce. */
  function improve() {
    const run = uuid();
    updateDraft({ listingRun: run });
    setRunning(true);
    setError(null);
    void fetchAgent(run);
  }
  const productId = p?.id;
  const hasListing = !!draft.listing;
  useEffect(() => {
    // First visit (and after Redo): prefill from the agent; a remount (Strict Mode, a kept-mounted
    // route shown again) joins the run already on its way instead of sending another.
    if (!ready || !productId || hasListing) return;
    let run = getDraft().listingRun;
    if (!run) { run = uuid(); updateDraft({ listingRun: run }); }
    void fetchAgent(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAgent is recreated each render; run once per product
  }, [ready, productId, hasListing]);

  // A 409 (print check, moderation) lands under the form: bring the card above the pinned bar.
  const errorRef = useRef<HTMLDivElement>(null);
  // Focus goes there too, so a keyboard user continues from the card instead of the top of the page.
  useEffect(() => {
    if (!error || !errorRef.current) return;
    errorRef.current.scrollIntoView({ block: "center" });
    errorRef.current.focus({ preventScroll: true });
  }, [error]);

  const cents = toCents(price);
  const bps = creator?.split?.creator_bps ?? 5000;
  const earn = cents ? Math.floor((cents * bps) / 10000) : null;
  const printOk = draft.listing?.print_ok;

  /** Approve; `acceptPrintWarning` after "Use anyway" on a contrast warning (round 3 ruling 2). */
  async function submit(e?: FormEvent, acceptPrintWarning = false) {
    e?.preventDefault();
    if (!p) return;
    const errs = { title: title.trim() ? undefined : m.create.listing.nameRequired, price: cents ? undefined : m.create.listing.priceInvalid };
    setErrors(errs);
    if (errs.title || errs.price) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ product: Product; storyVideoNeeded: boolean }>(`listings/${p.id}/approve`, {
        json: { approvedVia: "tap", edits: { title: title.trim(), description: description.trim(), priceCents: cents }, ...(acceptPrintWarning ? { acceptPrintWarning: true } : {}) },
      });
      updateDraft({ productRecord: res.product, listingTitle: title.trim(), storyVideoNeeded: res.storyVideoNeeded });
      router.push(res.storyVideoNeeded ? "/create/story-video" : "/create/live");
    } catch (err) {
      // 409 print_check_failed / moderation_failed: stay on the form and show the reason.
      setFailedCall("approve");
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  const art = cutoutOf(draft, p?.artworkId);
  const tote = p?.type === "tote";
  return (
    <ListingView
      uid={uid}
      mockup={{ src: pictureOf(p, art).src, shadow: pictureOf(p, art).kind === "sticker", alt: fmt(m.create.ready.mockupAlt, { product: tote ? m.common.tote : m.common.sticker }) }}
      drafting={running && !draft.listing}
      improving={running && !!draft.listing}
      submitting={submitting}
      title={title}
      description={description}
      price={price}
      errors={errors}
      earnCents={earn}
      printOk={printOk}
      printCheck={draft.listing?.print_check ?? null}
      trace={draft.trace ?? []}
      showTrace={showTrace}
      error={error}
      errorRef={errorRef}
      canRedo={canRedoListing(draft)}
      on={{
        redo: () => { if (p) { setError(null); redoListing({ router, update }, p); } },
        accept: () => void submit(undefined, true),
        redoCut: canRedoListing(draft) && p ? () => { setError(null); redoCutout({ router, update }, p); } : undefined, title: setTitle, description: setDescription, price: setPrice, improve, retry: () => void (failedCall === "approve" ? submit() : improve()), toggleTrace: () => setShowTrace((v) => !v), submit }}
    />
  );
}
