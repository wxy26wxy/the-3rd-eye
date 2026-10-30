/**
 * Studio sign-in links for a creator code (T070, hardened in T090). Pure and browser-safe.
 *
 * - `link` (`/create/code#c=CODE`, the one to copy and send): the code sits in the fragment,
 *   which the browser never sends to the server, so it stays out of request logs and out of
 *   link-preview fetches. The page reads it with JavaScript and fills the field.
 * - `qr` (`/create/code?c=CODE`, inside the QR code only): some QR scanner apps drop the part
 *   after `#`, so the QR keeps the query form. That request does reach the server (and its
 *   logs); the QR is meant to be scanned in person, never posted.
 * Both only pre-fill the field; the person still taps Sign in.
 */
export function signInLinks(origin: string, code: string): { link: string; qr: string } {
  const c = encodeURIComponent(code);
  const base = `${origin.replace(/\/+$/, "")}/create/code`;
  return { link: `${base}#c=${c}`, qr: `${base}?c=${c}` };
}

/** The code from a sign-in link's fragment (`#c=CODE`): trimmed, uppercased, at most 64 characters; "" when absent. */
export function readCodeFragment(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  let value: string | null = null;
  try {
    value = new URLSearchParams(raw).get("c");
  } catch {
    return "";
  }
  return value ? value.trim().toUpperCase().slice(0, 64) : "";
}
