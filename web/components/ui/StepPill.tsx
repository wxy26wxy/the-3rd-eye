/**
 * Step position for assistive technology only (Sky has no visible step pill).
 * Renders "Step 1 of 3" as visually hidden text; `step` and `total` stay for call sites.
 */
export function StepPill({ label }: { step: number; total: number; label: string }) {
  return <p className="visually-hidden">{label}</p>;
}
