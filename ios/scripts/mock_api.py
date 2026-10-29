#!/usr/bin/env python3
"""Tiny stand-in for /api/v1 so the iOS flow can run without the backend.

Usage: python3 ios/scripts/mock_api.py [port]   (default 3999)
Build the app against it: xcodebuild ... API_BASE_URL=http://localhost:3999
Shapes follow docs/api.md. Images point at a 1x1 PNG served here.
"""
import json
import sys
import time
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
        "cutPathSvg": None, "altText": "Green frog with a gold crown",
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


ROUTES = {
    ("POST", "/api/v1/auth/code"): lambda b: {"token": "c-test.mock", "creator": CREATOR},
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
    ("POST", "/api/v1/artworks"): lambda b: (time.sleep(2), {"artworks": [artwork(1)]})[1],
    ("GET", "/api/v1/artworks"): lambda b: {"artworks": [artwork(1)]},
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
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if path == "/img.png":
            return self._send(200, PNG, "image/png")
        fn = ROUTES.get((method, path))
        if not fn:
            return self._send(404, {"error": {"code": "not_found", "message": f"mock has no {method} {path}"}})
        try:
            body = json.loads(raw) if raw else {}
        except ValueError:
            body = {}
        self._send(200, fn(body))

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")

    def log_message(self, fmt, *args):
        sys.stderr.write("mock_api: " + (fmt % args) + "\n")


if __name__ == "__main__":
    print(f"mock_api listening on {BASE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
