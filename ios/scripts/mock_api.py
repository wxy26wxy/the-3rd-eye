#!/usr/bin/env python3
"""Tiny stand-in for /api/v1 so the iOS flow can run without the backend.

Usage: python3 ios/scripts/mock_api.py [port]   (default 3999)
Build the app against it: xcodebuild ... API_BASE_URL=http://localhost:3999
Shapes follow docs/api.md. Images point at a 1x1 PNG served here.
Photo flow: launch the app with UITEST_PHOTO=1 and MOCK_BLOB_API=<base>/blob/ (UI tests do);
POST /artworks {source: photo} answers 2 candidates and imageSize 1200x1600 (sign-in code ONE...: 1).
Sign-in NOCUT... makes cleanup answer 422, DETAILS... gives cleanup non-empty details.
GET /__mock/last/<cleanup|select|artworks|products|approve|delete> returns the last body the app sent there
(for delete: {"id": ...}).
My designs (T083): GET /artworks lists four designs, d1 in the shop (photo, published sticker),
d2 a draft (sticker draft with a listing title), d3 failed (lastError, no cutout), d4 still cutting
(made just now). GET/DELETE /artworks/<id>, POST /products, POST /listings/<id>/approve answer for them;
signing in again restores the list.
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3999
BASE = f"http://localhost:{PORT}"
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c63f8cfc0f01f0005000201a5d8b1c9"
    "0000000049454e44ae426082")

CREATOR = {
    "id": "c-test", "slug": "test", "displayName": "Test Artist", "studioName": "Mock Studio",
    "avatarUrl": None, "bioShort": None, "storyText": None, "storyVideoUrl": None, "storyVideoVtt": None,
    "mentionDisability": False,
    "accessPrefs": {"voiceFirst": True, "simpleMode": True, "speakDescriptions": True,
                    "highContrast": False, "largeText": False, "helperMode": False},
    "split": {"creator_bps": 5000, "org_bps": 3000, "production_bps": 2000}, "isExample": True,
}


def artwork(i):
    return {
        "id": f"a{i}", "creatorId": "c-test", "source": "text2image", "transcript": "a frog with a crown",
        "shapedPrompt": "A frog", "originalUrl": None, "cleanedUrl": f"{BASE}/img.png", "maskUrl": None,
        "cutPathSvg": None, "altText": "Green frog with a gold crown" + ("" if i == 1 else f", version {i}"),
        "spokenDescription": "A smiling green frog sits in the middle. It wears a small gold crown with three points, "
                             "and it has big round eyes and thick dark outlines.",
        "differencesFromPrompt": None, "genResponseId": f"r{i}", "parentArtworkId": None,
        "status": "draft", "createdAt": "2026-10-28T22:00:00Z", "previewUrl": f"{BASE}/img.png",
    }


STORY_DRAFT = {
    "headline": "Frogs with crowns", "bio_short": "I draw happy frogs.",
    "story_text": "I have drawn frogs since I was little. Each one gets a crown because everyone deserves to feel special.",
    "provider": "mock",
}


def story_video(body):
    # Captions come from the WAV soundtrack; the app should always send one with the video.
    print(f"mock_api: story-video videoUrl={body.get('videoUrl')} audioUrl={body.get('audioUrl')}", file=sys.stderr, flush=True)
    return {**CREATOR, "storyVideoUrl": body.get("videoUrl"), "storyVideoVtt": "WEBVTT\n" if body.get("audioUrl") else None,
            "storyDraft": STORY_DRAFT}


def thank_you(body):
    if body.get("draft"):
        return {"draftText": "Thank you so much for buying my art!", "provider": "mock"}
    print(f"mock_api: thank-you videoUrl={body.get('videoUrl')} audioUrl={body.get('audioUrl')}", file=sys.stderr, flush=True)
    return {"id": "t1", "orderId": "o1", "text": body.get("text"), "imageUrl": body.get("imageUrl"),
            "videoUrl": body.get("videoUrl"), "createdAt": "2026-10-29T10:00:00Z"}


# Photo flow (T082). The app's UI-test photo is 600 x 800; the stored original is "upscaled" x2.
IMAGE_SIZE = {"w": 1200, "h": 1600}
CANDIDATES = [
    {"id": "cand-1", "bbox": [100, 160, 500, 693], "score": 0.92, "thumbUrl": f"{BASE}/img.png"},
    {"id": "cand-2", "bbox": [660, 896, 1060, 1429], "score": 0.88, "thumbUrl": f"{BASE}/img.png"},
]
# Last request body per route, read back by UI tests through GET /__mock/last/<name>.
LAST = {}
# A sign-in code starting with ONE makes photo answers carry a single, already cut-out candidate.
# NOCUT… makes every cleanup answer 422; DETAILS… makes it carry non-empty details.
MODE = {"single": False, "fail": False, "details": False}
CUTS = {"n": 0}


def photo_artwork(cleaned=None, alt=None):
    return {
        "id": "p1", "creatorId": "c-test", "source": "photo", "transcript": None, "shapedPrompt": None,
        "originalUrl": f"{BASE}/img.png", "cleanedUrl": cleaned, "maskUrl": None, "cutPathSvg": None,
        "altText": alt, "spokenDescription": None, "differencesFromPrompt": None, "genResponseId": None,
        "parentArtworkId": None, "status": "ready" if cleaned else "draft", "createdAt": "2026-10-29T10:00:00Z",
    }


def create_artwork(body):
    if body.get("source") in ("photo", "canvas"):
        LAST["artworks"] = body
        if MODE["single"]:
            return {"artwork": photo_artwork(f"{BASE}/img.png?cut=0", "Cut-out of piece 1"),
                    "candidates": CANDIDATES[:1], "imageSize": IMAGE_SIZE}
        return {"artwork": photo_artwork(), "candidates": CANDIDATES, "imageSize": IMAGE_SIZE}
    time.sleep(2)
    return {"artworks": [artwork(i + 1) for i in range(int(body.get("n") or 1))]}


def select(body):
    LAST["select"] = body
    return photo_artwork(f"{BASE}/img.png?select={body.get('candidateId')}", f"Cut-out of {body.get('candidateId')}")


class MockError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def check_cleanup(body):
    """The CleanupBody rules of docs/api.md (T080 §2); the server answers 400 like this."""
    bad = MockError(400, "invalid_request", "cleanup body does not match the contract")
    if not any(k in body for k in ("candidateIds", "points", "box")) or set(body) - {"candidateIds", "points", "box"}:
        raise bad
    ids = body.get("candidateIds")
    if ids is not None:
        if not isinstance(ids, list) or not 1 <= len(ids) <= 6:
            raise bad
        if any(i not in {c["id"] for c in CANDIDATES} for i in ids):
            raise MockError(400, "invalid_candidate", "unknown candidate id")
    points = body.get("points")
    if points is not None:
        if not isinstance(points, list) or not 1 <= len(points) <= 10:
            raise bad
        for p in points:
            if not isinstance(p.get("x"), (int, float)) or not isinstance(p.get("y"), (int, float)) \
                    or p.get("label", "positive") not in ("positive", "negative"):
                raise bad
        if "box" not in body and ids is None and not any(p.get("label", "positive") == "positive" for p in points):
            raise bad
    box = body.get("box")
    if box is not None and (not isinstance(box, list) or len(box) != 4 or not (box[0] < box[2] and box[1] < box[3])):
        raise bad


def cleanup(body):
    LAST["cleanup"] = body
    print(f"mock_api: cleanup {json.dumps(body)}", file=sys.stderr, flush=True)
    check_cleanup(body)
    if MODE["fail"]:
        raise MockError(422, "no_drawing_found", "Nothing was left in the cutout.")
    CUTS["n"] += 1
    details = {"failedProductIds": [], "unpublishedProductIds": []}
    if MODE["details"]:
        details = {"failedProductIds": ["pr1"], "unpublishedProductIds": ["pr2"]}
    return {**photo_artwork(f"{BASE}/img.png?cut={CUTS['n']}", "Cut-out preview"), "details": details}


def artwork_detail(_body):
    cands = CANDIDATES[:1] if MODE["single"] else CANDIDATES
    return {"artwork": photo_artwork(), "candidates": cands, "imageSize": IMAGE_SIZE, "originalUrl": f"{BASE}/img.png"}


# My designs (T083). Rebuilt on each sign-in so a deleted design comes back for the next test.
def designs():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def row(i, source, cleaned, alt, products, last_error=None, created="2026-10-29T09:00:00.000Z"):
        return {
            "id": i, "creatorId": "c-test", "source": source, "transcript": None, "shapedPrompt": None,
            "originalUrl": f"{BASE}/img.png", "cleanedUrl": cleaned, "maskUrl": None, "cutPathSvg": None,
            "altText": alt, "spokenDescription": None, "differencesFromPrompt": None, "genResponseId": None,
            "parentArtworkId": None, "status": "ready" if cleaned else "draft", "lastError": last_error,
            "createdAt": created, "products": products,
        }
    return [
        row("d1", "photo", f"{BASE}/img.png?d=1", "Blue bird on a branch",
            [{"id": "pr-d1", "type": "sticker", "status": "published", "title": "Blue Bird Sticker"}]),
        row("d2", "text2image", f"{BASE}/img.png?d=2", "Green frog with a gold crown",
            [{"id": "pr-d2", "type": "sticker", "status": "draft", "title": "Frog King Sticker"}]),
        row("d3", "photo", None, "Red flower", [], last_error="The cutout timed out."),
        row("d4", "photo", None, "Yellow sun", [], created=now),
    ]


DESIGNS = {"list": designs()}


def find_design(artwork_id):
    for d in DESIGNS["list"]:
        if d["id"] == artwork_id:
            return d
    raise MockError(404, "not_found", "no such artwork")


def design_detail(artwork_id):
    d = find_design(artwork_id)
    art = {k: v for k, v in d.items() if k != "products"}
    return {"artwork": art, "candidates": CANDIDATES, "imageSize": IMAGE_SIZE, "originalUrl": f"{BASE}/img.png"}


def delete_design(artwork_id):
    d = find_design(artwork_id)
    LAST["delete"] = {"id": artwork_id}
    DESIGNS["list"] = [x for x in DESIGNS["list"] if x["id"] != artwork_id]
    return {"id": artwork_id, "deleted": True, "archivedProductIds": [p["id"] for p in d["products"]]}


def design_cleanup(artwork_id, body):
    d = find_design(artwork_id)
    result = cleanup(body)
    d["cleanedUrl"], d["status"], d["lastError"] = result["cleanedUrl"], "ready", None
    return {**result, "id": artwork_id, "altText": d["altText"]}


def create_product(body):
    LAST["products"] = body
    if body.get("artworkId") in {d["id"] for d in DESIGNS["list"]} and not find_design(body["artworkId"])["cleanedUrl"]:
        raise MockError(409, "artwork_not_ready", "Pick and clean up the artwork first")
    return {"id": f"pr-new-{body.get('type')}", "artworkId": body.get("artworkId"), "creatorId": "c-test",
            "type": body.get("type"), "mockupUrl": f"{BASE}/img.png", "printPngUrl": None, "printSvgUrl": None,
            "priceCents": 500, "status": "draft"}


def approve(product_id, body):
    LAST["approve"] = {**body, "productId": product_id}
    edits = body.get("edits") or {}
    for d in DESIGNS["list"]:
        for p in d["products"]:
            if p["id"] == product_id:
                p["status"] = "published"
                p["title"] = edits.get("title") or p["title"]
    title = edits.get("title") or "Listing"
    return {"product": {"id": product_id, "artworkId": None, "creatorId": "c-test", "type": "sticker",
                        "mockupUrl": f"{BASE}/img.png", "printPngUrl": None, "printSvgUrl": None,
                        "priceCents": edits.get("priceCents") or 500, "status": "published"},
            "listing": {"productId": product_id, "title": title, "description": edits.get("description"),
                        "tags": [], "priceSuggestionCents": 500, "approvedAt": "2026-10-30T10:00:00Z",
                        "approvedVia": body.get("approvedVia"), "madeByVoice": False},
            "storyVideoNeeded": False}


# Routes with an id in the path: (method, regex) -> fn(id, body).
PATTERN_ROUTES = [
    ("GET", re.compile(r"^/api/v1/artworks/(d\d+)$"), lambda i, b: design_detail(i)),
    ("DELETE", re.compile(r"^/api/v1/artworks/([\w-]+)$"), lambda i, b: delete_design(i)),
    ("POST", re.compile(r"^/api/v1/artworks/(d\d+)/cleanup$"), design_cleanup),
    ("POST", re.compile(r"^/api/v1/listings/([\w-]+)/approve$"), approve),
]


def blob_put(_body, query=""):
    pathname = query.split("pathname=", 1)[1].split("&")[0] if "pathname=" in query else "upload.bin"
    return {"url": f"{BASE}/img.png", "downloadUrl": f"{BASE}/img.png", "pathname": pathname, "contentType": "image/jpeg"}


def sign_in(body):
    # A code starting with MULTI signs in with simpleMode off, so the app asks for 3 pictures.
    multi = str(body.get("code", "")).upper().startswith("MULTI")
    code = str(body.get("code", "")).upper()
    MODE["single"] = code.startswith("ONE")
    MODE["fail"] = code.startswith("NOCUT")
    MODE["details"] = code.startswith("DETAILS")
    LAST.clear()
    DESIGNS["list"] = designs()
    creator = {**CREATOR, "accessPrefs": {**CREATOR["accessPrefs"], "simpleMode": not multi}}
    return {"token": "c-test.mock", "creator": creator}


ROUTES = {
    ("POST", "/api/v1/auth/code"): sign_in,
    ("GET", "/api/v1/creators/me"): lambda b: CREATOR,
    ("PUT", "/api/v1/creators/me"): lambda b: {**CREATOR, **{k: v for k, v in b.items() if k in CREATOR}},
    ("POST", "/api/v1/creators/me/story-video"): story_video,
    ("GET", "/api/v1/creators/me/story-prompts"): lambda b: {
        "prompts": ["Who are you?", "What do you love to make?", "Why do you make art?"]},
    ("POST", "/api/v1/orders/o1/thank-you"): thank_you,
    ("POST", "/api/v1/prompts/shape"): lambda b: {
        "prompt": "A cheerful green frog wearing a gold crown", "style_notes": "",
        "clarifying_question": None,
        "spoken_confirmation": "A happy frog with a gold crown. Drawing it now."},
    ("POST", "/api/v1/artworks"): create_artwork,
    ("POST", "/api/v1/artworks/p1/select"): select,
    ("POST", "/api/v1/artworks/p1/cleanup"): cleanup,
    ("GET", "/api/v1/artworks/p1"): artwork_detail,
    # Blob client upload: token event, then the PUT the app sends to MOCK_BLOB_API (= BASE/blob/).
    ("POST", "/api/v1/uploads"): lambda b: {"clientToken": "vercel_blob_client_mockstore_token"},
    ("GET", "/api/v1/artworks"): lambda b: {"artworks": DESIGNS["list"]},
    ("POST", "/api/v1/products"): create_product,
    ("GET", "/api/v1/orders"): lambda b: {"orders": [], "unread": 0},
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle(self, method):
        path, _, query = self.path.partition("?")
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if path == "/img.png":
            return self._send(200, PNG, "image/png")
        if method == "PUT" and path == "/blob/":
            return self._send(200, blob_put(None, query))
        if method == "GET" and path.startswith("/__mock/last/"):
            return self._send(200, LAST.get(path.rsplit("/", 1)[1]) or {})
        fn = ROUTES.get((method, path))
        if not fn:
            for m, pattern, handler in PATTERN_ROUTES:
                match = pattern.match(path) if m == method else None
                if match:
                    fn = (lambda h, i: lambda b: h(i, b))(handler, match.group(1))
                    break
        if not fn:
            return self._send(404, {"error": {"code": "not_found", "message": f"mock has no {method} {path}"}})
        try:
            body = json.loads(raw) if raw else {}
        except ValueError:
            body = {}
        try:
            self._send(200, fn(body))
        except MockError as e:
            self._send(e.status, {"error": {"code": e.code, "message": e.message}})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")

    def do_DELETE(self):
        self._handle("DELETE")

    def log_message(self, fmt, *args):
        sys.stderr.write("mock_api: " + (fmt % args) + "\n")


if __name__ == "__main__":
    print(f"mock_api listening on {BASE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
