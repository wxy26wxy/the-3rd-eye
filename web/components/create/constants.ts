/** Name of the httpOnly cookie holding the creator bearer token (set by /create/code/session). */
export const CREATOR_COOKIE = "ms_creator";
/**
 * Readable (not httpOnly) cookie with a random id per sign-in. It grants nothing; the creator flow
 * keeps its sessionStorage cache (draft + `creators/me`) only while this id matches, so signing in as
 * someone else, or signing out, drops the previous creator's cache (T127).
 */
export const CREATOR_SESSION_COOKIE = "ms_creator_session";
/** /create routes that work without signing in. */
export const CREATE_PUBLIC_PATHS = ["/create", "/create/code", "/create/code/session"];
