/** `/media/<pathname>?tag=<token>` for order-scoped files; public http(s) URLs pass through. */
export function tagMediaSrc(pathOrUrl: string, token: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `/media/${path}?tag=${encodeURIComponent(token)}`;
}
