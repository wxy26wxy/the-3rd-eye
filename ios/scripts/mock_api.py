#!/usr/bin/env python3
"""Tiny stand-in for /api/v1 so the iOS flow can run without the backend.

Usage: python3 ios/scripts/mock_api.py [port]   (default 3999)
Build the app against it: xcodebuild ... API_BASE_URL=http://localhost:3999
Shapes follow docs/api.md. Images point at a 1x1 PNG served here.
Photo flow: launch the app with UITEST_PHOTO=1 and MOCK_BLOB_API=<base>/blob/ (UI tests do);
POST /artworks {source: photo} answers 2 candidates and imageSize 1200x1600 (sign-in code ONE...: 1,
NONE...: no drawing found, 0 candidates; T114).
Sign-in NOCUT... makes cleanup answer 422, DETAILS... gives cleanup non-empty details, SLOW... makes
cleanup take 4 s (switching tabs meanwhile must not lose the cut).
GET /__mock/last/<cleanup|select|artworks|products|approve|delete> returns the last body the app sent there
(for delete: {"id": ...}). Cleanup accepts clipToBox (boolean, needs box; T126) and echoes it there.
My designs (T083): GET /artworks lists four designs, d1 in the shop (photo, published sticker),
d2 a draft (sticker draft with a listing title), d3 failed (lastError, no cutout), d4 still cutting
(made just now), d5 in the shop as a tote from an older server (no price in the summary).
d6 in the shop as a sticker and with a sticker draft too ("Make another sticker" continues the draft).
d1's live price (8.00) differs from the listing suggestion (5.00). GET/DELETE /artworks/<id>, POST /products, POST /listings/<id>/approve answer for them;
signing in again restores the list.
Approve refusals (T091): a title or description containing "unkind" answers 409 moderation_failed;
sign-in NOPRINT... makes every approve answer 409 print_check_failed. Both carry technical messages,
as the server's can, so the app must show its own words.
Change it (T111): POST /artworks/<id>/change {instruction, transcript?} sleeps 2 s and answers a child
artwork ch<n> (parentArtworkId = <id>, previewUrl, cleanedUrl null) with a description; an instruction
containing "nothing" gives description.differences "" (the app shows its own copy). POST
/artworks/<id>/cutout answers the cut-out row, the two candidates (largest first) and imageSize, only for
a change result ch<n> (any other id: 409 not_a_change, as the server); sign-in NOCUT... makes it 422, and
NOCUTOUT... makes only it 422 (Adjust the area still cuts; T122). Cleanup names the piece it was
sent ("Cut-out of cand-1").
Your cutout after a change (T129): POST /artworks/ch<n>/cleanup takes the same body (points, the
whole-picture box or the frame, clipToBox) and answers that change row with the new cut (404 for an
unknown ch<n>); the body is in GET /__mock/last/cleanup. GET /artworks/ch<n> has candidates and imageSize
once its cutout ran (before: no candidates, as the server).
change answers 201 like the server. GET /__mock/last/<change|cutout> as above.
Sticker preview, listing run, story video (T121): every sticker product carries previewUrl
(<base>/sticker-preview.png, a 240 px bordered die-cut sticker on transparency; totes: null).
POST /listings/<id>/run sleeps 2 s and answers {listing, trace} (title/description/price_cents filled;
GET /__mock/last/run has the product id). GET /creators/me returns storyVideoUrl (a pathname the mock
serves at /media/<pathname>, a short MP4 with Range support) and storyVideoVtt; sign-in NOVIDEO...
returns both null ("No story video yet"); POST /creators/me/story-video replaces them.
"""
import json
import math
import os
import re
import struct
import sys
import time
import zlib
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3999
BASE = f"http://localhost:{PORT}"
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c63f8cfc0f01f0005000201a5d8b1c9"
    "0000000049454e44ae426082")



def _png_rgba(width, height, pixel):
    """Encodes an RGBA PNG; pixel(x, y) -> (r, g, b, a)."""
    rows = b"".join(b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(width)) for y in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def _sticker_pixel(x, y, size=240):
    """A green disc with a dark outline inside a white die-cut border, transparent outside (T121 preview)."""
    d = math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2)
    if d > 116:
        return (0, 0, 0, 0)
    if d > 100:
        return (255, 255, 255, 255)
    if d > 92:
        return (20, 24, 32, 255)
    return (59, 178, 115, 255)


# The bordered sticker preview every mock sticker product points at (previewUrl).
STICKER_PREVIEW_PNG = _png_rgba(240, 240, _sticker_pixel)
# Story video sample served at /media/<pathname> (any short MP4 in the repo).
_HERE = os.path.dirname(os.path.abspath(__file__))
STORY_MP4_PATH = os.path.join(_HERE, "..", "App", "Resources", "Animations", "sticker-loading.mp4")
STORY_VIDEO_PATH = "creators/c-test/story-video/mock-story.mp4"
STORY_VTT = ("WEBVTT\n\n00:00.000 --> 00:02.000\nHi, I am Test Artist.\n\n"
             "00:02.000 --> 00:04.000\nI draw frogs with crowns.\n")
STORY = {"url": STORY_VIDEO_PATH, "vtt": STORY_VTT}


def preview_for(product_id, kind):
    return f"{BASE}/sticker-preview.png?p={product_id}" if kind == "sticker" else None


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
    STORY["url"], STORY["vtt"] = body.get("videoUrl"), (STORY_VTT if body.get("audioUrl") else None)
    return {**CREATOR, "storyVideoUrl": STORY["url"], "storyVideoVtt": STORY["vtt"],
            "mentionDisability": bool(body.get("mentionDisability", CREATOR["mentionDisability"])), "storyDraft": STORY_DRAFT}


def creator_me(_body):
    return {**CREATOR, "storyVideoUrl": STORY["url"], "storyVideoVtt": STORY["vtt"]}


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
MODE = {"nocutout": False, "single": False, "none": False, "fail": False, "details": False, "slow": False, "noprint": False, "novideo": False}
CUTS = {"n": 0}


def photo_artwork(cleaned=None, alt=None):
    return {
        "id": "p1", "creatorId": "c-test", "source": "photo", "transcript": None, "shapedPrompt": None,
        "originalUrl": f"{BASE}/img.png", "cleanedUrl": cleaned, "maskUrl": None, "cutPathSvg": None,
        "altText": alt, "spokenDescription": None, "differencesFromPrompt": None, "genResponseId": None,
        "parentArtworkId": None, "changeInstruction": None, "status": "ready" if cleaned else "draft",
        "lastError": None, "createdAt": "2026-10-29T10:00:00Z",
    }


# Change it (T111): each change makes a new child row ch1, ch2, ... (the last body is in LAST["change"]).
CHANGES = {"n": 0, "rows": {}, "cut": set()}


def change_artwork(artwork_id, body):
    LAST["change"] = {**body, "artworkId": artwork_id}
    instruction = str(body.get("instruction") or "").strip()
    if not instruction or len(instruction) > 1000:
        raise MockError(400, "invalid_request", "instruction must be 1-1000 characters")
    time.sleep(2)
    CHANGES["n"] += 1
    child_id = f"ch{CHANGES['n']}"
    differences = "" if "nothing" in instruction.lower() else "The sky is purple now; the bus and the trees are the same."
    child = {
        **photo_artwork(), "id": child_id, "parentArtworkId": artwork_id, "changeInstruction": instruction,
        "transcript": body.get("transcript"), "genResponseId": f"resp-{child_id}",
        "altText": "Yellow school bus under a purple sky",
        "spokenDescription": "A yellow school bus drives along a road. The sky above it is purple now.",
        "differencesFromPrompt": differences or None, "previewUrl": f"{BASE}/img.png?change={CHANGES['n']}",
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    CHANGES["rows"][child_id] = child
    return 201, {"artwork": child, "description": {
        "alt": child["altText"], "spoken": child["spokenDescription"], "differences": differences}}


def cutout_artwork(artwork_id, body):
    LAST["cutout"] = {**body, "artworkId": artwork_id}
    if artwork_id not in CHANGES["rows"]:
        raise MockError(409, "not_a_change", "Only a changed picture needs a new cutout")
    if MODE["fail"] or MODE["nocutout"]:
        raise MockError(422, "no_drawing_found", "nothing found in the edited picture")
    base = CHANGES["rows"][artwork_id]
    row = {**base, "cleanedUrl": f"{BASE}/img.png?cutout={artwork_id}", "status": "ready",
           "cutPathSvg": "M10 10 L90 10 L90 90 L10 90 Z", "lastError": None}
    row.pop("previewUrl", None)
    CHANGES["rows"][artwork_id] = {**row, "previewUrl": base.get("previewUrl")}
    CHANGES["cut"].add(artwork_id)
    return {"artwork": row, "candidates": CANDIDATES, "imageSize": IMAGE_SIZE}


def change_detail(artwork_id):
    """GET a change result: like the server, its candidates exist only after its cutout."""
    row = CHANGES["rows"].get(artwork_id)
    if not row:
        raise MockError(404, "not_found", "no such artwork")
    cands = CANDIDATES if artwork_id in CHANGES["cut"] else []
    return {"artwork": {k: v for k, v in row.items() if k != "previewUrl"}, "candidates": cands,
            "imageSize": IMAGE_SIZE, "originalUrl": f"{BASE}/img.png", "previewUrl": row.get("previewUrl")}


def change_cleanup(artwork_id, body):
    """Your cutout after a change (T129): cleanup on ch<n> (points, the whole-picture box or the frame,
    clipToBox) answers that change row with the new cut; the body is echoed in /__mock/last/cleanup."""
    base = CHANGES["rows"].get(artwork_id)
    if not base:
        raise MockError(404, "not_found", "no such artwork")
    result = cleanup(body)
    row = {**base, "cleanedUrl": result["cleanedUrl"], "altText": result["altText"], "status": "ready",
           "cutPathSvg": "M10 10 L90 10 L90 90 L10 90 Z", "lastError": None}
    CHANGES["rows"][artwork_id] = row
    return {**{k: v for k, v in row.items() if k != "previewUrl"}, "details": result["details"]}


def create_artwork(body):
    if body.get("source") in ("photo", "canvas"):
        LAST["artworks"] = body
        if MODE["none"]:
            return {"artwork": photo_artwork(), "candidates": [], "imageSize": IMAGE_SIZE}
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
    if not any(k in body for k in ("candidateIds", "points", "box")) or set(body) - {"candidateIds", "points", "box", "clipToBox"}:
        raise bad
    # T126: clipToBox is a boolean and needs a box (the "Adjust the area" screens send it with the frame).
    if "clipToBox" in body and (not isinstance(body["clipToBox"], bool) or (body["clipToBox"] and "box" not in body)):
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
    if MODE["slow"]:
        time.sleep(4)
    if MODE["fail"]:
        raise MockError(422, "no_drawing_found", "Nothing was left in the cutout.")
    CUTS["n"] += 1
    details = {"failedProductIds": [], "unpublishedProductIds": []}
    if MODE["details"]:
        details = {"failedProductIds": ["pr1"], "unpublishedProductIds": ["pr2"]}
    # Adjust the area (T122) sends the picked piece with the frame: the alt text names that piece.
    ids = body.get("candidateIds") or []
    alt = f"Cut-out of {ids[0]}" if ids else "Cut-out preview"
    return {**photo_artwork(f"{BASE}/img.png?cut={CUTS['n']}", alt), "details": details}


def artwork_detail(_body):
    cands = [] if MODE["none"] else CANDIDATES[:1] if MODE["single"] else CANDIDATES
    return {"artwork": photo_artwork(), "candidates": cands, "imageSize": IMAGE_SIZE, "originalUrl": f"{BASE}/img.png"}


# My designs (T083). Rebuilt on each sign-in so a deleted design comes back for the next test.
def designs():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def row(i, source, cleaned, alt, products, last_error=None, created="2026-10-29T09:00:00.000Z"):
        return {
            "id": i, "creatorId": "c-test", "source": source, "transcript": None, "shapedPrompt": None,
            "originalUrl": f"{BASE}/img.png", "cleanedUrl": cleaned, "maskUrl": None, "cutPathSvg": None,
            "altText": alt, "spokenDescription": None, "differencesFromPrompt": None, "genResponseId": None,
            "parentArtworkId": None, "changeInstruction": None, "status": "ready" if cleaned else "draft", "lastError": last_error,
            "createdAt": created, "products": [{**p, "previewUrl": preview_for(p["id"], p["type"])} for p in products],
        }
    return [
        # Live price 8.00 differs from the agent's suggestion 5.00 (SUGGESTED_CENTS): an approve
        # without priceCents must keep 8.00 (T087 backend), and the app always sends the price anyway.
        row("d1", "photo", f"{BASE}/img.png?d=1", "Blue bird on a branch",
            [{"id": "pr-d1", "type": "sticker", "status": "published", "title": "Blue Bird Sticker",
              "priceCents": 800, "description": "A blue bird singing on a branch.", "mockupUrl": f"{BASE}/img.png?m=1"}]),
        row("d2", "text2image", f"{BASE}/img.png?d=2", "Green frog with a gold crown",
            [{"id": "pr-d2", "type": "sticker", "status": "draft", "title": "Frog King Sticker",
              "priceCents": 600, "description": "A frog wearing a crown.", "mockupUrl": f"{BASE}/img.png?m=2"}]),
        row("d3", "photo", None, "Red flower", [], last_error="The cutout timed out."),
        row("d4", "photo", None, "Yellow sun", [], created=now),
        # An older server: the product summary has no price, description or mockup.
        row("d5", "photo", f"{BASE}/img.png?d=5", "Purple cat",
            [{"id": "pr-d5", "type": "tote", "status": "published", "title": "Purple Cat Tote"}]),
        # A sticker in the shop and a second sticker still a draft (newest first, as the server sends).
        row("d6", "photo", f"{BASE}/img.png?d=6", "Orange fish",
            [{"id": "pr-d6b", "type": "sticker", "status": "draft", "title": "Fish Friend Sticker",
              "priceCents": 700, "description": "A second fish.", "mockupUrl": f"{BASE}/img.png?m=6b"},
             {"id": "pr-d6", "type": "sticker", "status": "published", "title": "Orange Fish Sticker",
              "priceCents": 900, "description": "An orange fish.", "mockupUrl": f"{BASE}/img.png?m=6"}]),
    ]


SUGGESTED_CENTS = 500


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
    product_id = f"pr-new-{body.get('type')}"
    return {"id": product_id, "artworkId": body.get("artworkId"), "creatorId": "c-test",
            "type": body.get("type"), "mockupUrl": f"{BASE}/img.png", "previewUrl": preview_for(product_id, body.get("type")),
            "printPngUrl": None, "printSvgUrl": None,
            "priceCents": 500, "status": "draft"}


def approve(product_id, body):
    LAST["approve"] = {**body, "productId": product_id}
    edits = body.get("edits") or {}
    if MODE.get("noprint"):
        raise MockError(409, "print_check_failed", "effective dpi 96 < 150; contrast 1.2:1")
    words = f"{edits.get('title') or ''} {edits.get('description') or ''}".lower()
    if "unkind" in words:
        raise MockError(409, "moderation_failed", "flagged: harassment (0.91)")
    price = edits.get("priceCents")
    kind = "tote" if product_id.endswith("tote") else "sticker"
    for d in DESIGNS["list"]:
        for p in d["products"]:
            if p["id"] == product_id:
                kind = p["type"]
                p["status"] = "published"
                p["title"] = edits.get("title") or p["title"]
                p["priceCents"] = price or p.get("priceCents") or SUGGESTED_CENTS
                price = p["priceCents"]
                if "description" in edits:
                    p["description"] = edits["description"]
    title = edits.get("title") or "Listing"
    return {"product": {"id": product_id, "artworkId": None, "creatorId": "c-test", "type": kind,
                        "mockupUrl": f"{BASE}/img.png", "previewUrl": preview_for(product_id, kind), "printPngUrl": None, "printSvgUrl": None,
                        "priceCents": price or SUGGESTED_CENTS, "status": "published"},
            "listing": {"productId": product_id, "title": title, "description": edits.get("description"),
                        "tags": [], "priceSuggestionCents": SUGGESTED_CENTS, "approvedAt": "2026-10-30T10:00:00Z",
                        "approvedVia": body.get("approvedVia"), "madeByVoice": False},
            "storyVideoNeeded": False}


def run_listing(product_id, _body):
    """POST /listings/<id>/run: the listing agent's draft after about 2 s (the app shows its drafting card meanwhile)."""
    LAST["run"] = {"productId": product_id}
    time.sleep(2)
    kind, title, description = ("tote" if product_id.endswith("tote") else "sticker"), None, None
    for d in DESIGNS["list"]:
        for p in d["products"]:
            if p["id"] == product_id:
                kind, title, description = p["type"], p.get("title"), p.get("description")
    word = "Tote" if kind == "tote" else "Sticker"
    listing = {
        "title": title or f"Frog King {word}",
        "description": description or "A smiling green frog wearing a small gold crown, drawn with thick dark outlines.",
        "tags": ["frog", "crown", kind], "price_cents": 2500 if kind == "tote" else SUGGESTED_CENTS,
        "print_ok": True, "notes": "",
    }
    trace = [{"step": 1, "tool": "check_resolution", "result": {"ok": True}},
             {"step": 2, "tool": "check_contrast", "result": {"ok": True}},
             {"step": 3, "text": "Drafted the listing."}]
    return {"listing": listing, "trace": trace}


# Routes with an id in the path: (method, regex) -> fn(id, body).
PATTERN_ROUTES = [
    ("GET", re.compile(r"^/api/v1/artworks/(d\d+)$"), lambda i, b: design_detail(i)),
    ("DELETE", re.compile(r"^/api/v1/artworks/([\w-]+)$"), lambda i, b: delete_design(i)),
    ("POST", re.compile(r"^/api/v1/artworks/(d\d+)/cleanup$"), design_cleanup),
    ("POST", re.compile(r"^/api/v1/artworks/([\w-]+)/change$"), change_artwork),
    ("POST", re.compile(r"^/api/v1/artworks/([\w-]+)/cutout$"), cutout_artwork),
    ("POST", re.compile(r"^/api/v1/artworks/(ch\d+)/cleanup$"), change_cleanup),
    ("GET", re.compile(r"^/api/v1/artworks/(ch\d+)$"), lambda i, b: change_detail(i)),
    ("POST", re.compile(r"^/api/v1/listings/([\w-]+)/approve$"), approve),
    ("POST", re.compile(r"^/api/v1/listings/([\w-]+)/run$"), run_listing),
]


def blob_put(_body, query=""):
    pathname = query.split("pathname=", 1)[1].split("&")[0] if "pathname=" in query else "upload.bin"
    return {"url": f"{BASE}/img.png", "downloadUrl": f"{BASE}/img.png", "pathname": pathname, "contentType": "image/jpeg"}


def sign_in(body):
    # A code starting with MULTI signs in with simpleMode off, so the app asks for 3 pictures.
    multi = str(body.get("code", "")).upper().startswith("MULTI")
    code = str(body.get("code", "")).upper()
    MODE["single"] = code.startswith("ONE")
    MODE["none"] = code.startswith("NONE")
    MODE["nocutout"] = code.startswith("NOCUTOUT")
    MODE["fail"] = code.startswith("NOCUT") and not MODE["nocutout"]
    MODE["details"] = code.startswith("DETAILS")
    MODE["slow"] = code.startswith("SLOW")
    MODE["noprint"] = code.startswith("NOPRINT")
    MODE["novideo"] = code.startswith("NOVIDEO")
    STORY["url"], STORY["vtt"] = (None, None) if MODE["novideo"] else (STORY_VIDEO_PATH, STORY_VTT)
    LAST.clear()
    DESIGNS["list"] = designs()
    CHANGES["n"], CHANGES["rows"], CHANGES["cut"] = 0, {}, set()
    creator = {**CREATOR, "accessPrefs": {**CREATOR["accessPrefs"], "simpleMode": not multi}}
    return {"token": "c-test.mock", "creator": creator}


ROUTES = {
    ("POST", "/api/v1/auth/code"): sign_in,
    ("GET", "/api/v1/creators/me"): creator_me,
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

    def _send_media(self, data, ctype):
        """Serves bytes with single-range support (AVPlayer asks for byte ranges)."""
        rng = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range") or "")
        if not rng or not (rng.group(1) or rng.group(2)):
            self.send_response(200)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        start = int(rng.group(1)) if rng.group(1) else max(0, len(data) - int(rng.group(2)))
        end = int(rng.group(2)) if rng.group(1) and rng.group(2) else len(data) - 1
        end = min(end, len(data) - 1)
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{len(data)}")
            self.send_header("Content-Length", "0")
            return self.end_headers()
        part = data[start:end + 1]
        self.send_response(206)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
        self.send_header("Content-Length", str(len(part)))
        self.end_headers()
        self.wfile.write(part)

    def _handle(self, method):
        path, _, query = self.path.partition("?")
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if path == "/img.png":
            return self._send(200, PNG, "image/png")
        if path == "/sticker-preview.png":
            return self._send(200, STICKER_PREVIEW_PNG, "image/png")
        if method == "GET" and path.startswith("/media/") and path.endswith(".mp4"):
            try:
                with open(STORY_MP4_PATH, "rb") as f:
                    return self._send_media(f.read(), "video/mp4")
            except OSError:
                return self._send(404, {"error": {"code": "not_found", "message": "no sample video"}})
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
            result = fn(body)
            # A handler may answer (status, body), e.g. 201 for a created child artwork.
            status, result = result if isinstance(result, tuple) else (200, result)
            self._send(status, result)
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
