/**
 * Deprecated (Sky, T102): the boards have no scalloped edge. Renders nothing; the export stays
 * so older call sites compile. Use a plain section (`Sheet`) or `Eyebrow` instead.
 */
export function Scallop(props: { className?: string }) {
  void props;
  return null;
}
