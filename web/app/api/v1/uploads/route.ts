import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireCreator } from "@/lib/auth";
import { ApiError, json, route } from "@/lib/http";
import { isCreatorPath } from "@/lib/storage";
import { uploadRule } from "@/lib/uploads";

const PATH_RE = /^creators\/[0-9a-f-]{36}\/[a-z][a-z0-9-]{0,31}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;
/** Vercel Blob client-upload protocol. Token requests need creator auth; completion callbacks are signed by Blob. */
export const POST = route(async (req) => {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON");
  }
  if (!body || typeof body !== "object" || typeof (body as { type?: unknown }).type !== "string") {
    throw new ApiError(400, "invalid_request", "Not a Blob upload request");
  }
  const creatorId = body.type === "blob.generate-client-token" ? requireCreator(req).creatorId : null;
  const result = await handleUpload({
    body,
    request: req,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname) => {
      if (!creatorId || !isCreatorPath(pathname, creatorId) || !PATH_RE.test(pathname)) {
        throw new ApiError(403, "forbidden_path", "Upload pathname must be creators/<yourId>/<kind>/<uuid>.<ext>");
      }
      const rule = uploadRule(pathname);
      return {
        allowedContentTypes: rule.types,
        maximumSizeInBytes: rule.maxBytes,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({ creatorId }),
      };
    },
    onUploadCompleted: async () => {
      // Nothing to record: clients pass the pathname to the next API call.
    },
  });
  return json(result);
});
