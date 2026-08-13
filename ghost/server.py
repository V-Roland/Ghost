"""Local HTTP server for the interviewer dashboard.

Stdlib only, so `python3 -m ghost.server` runs with nothing installed.
The route shapes match what the Azure Functions app will expose, so the
front end does not change when the backend moves to Azure:

  POST /api/prepare  -> portfolio + JD  -> interview guide
  POST /api/review   -> guide + transcript -> evidence report
  GET  /api/sample   -> the bundled demo candidate, end to end
"""

import json
import logging
import os
import posixpath
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict

from .config import azure_configured, engine_name
from .pipeline import run

log = logging.getLogger("ghost.server")

WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
SAMPLE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "samples"
)

MAX_BODY_BYTES = 4 * 1024 * 1024

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
}


def _read_sample(name: str) -> str:
    with open(os.path.join(SAMPLE_DIR, name), "r", encoding="utf-8") as handle:
        return handle.read()


class GhostHandler(BaseHTTPRequestHandler):
    server_version = "Ghost/0.2"

    # --- plumbing ----------------------------------------------------------
    def log_message(self, fmt: str, *args: Any) -> None:
        log.info("%s - %s", self.address_string(), fmt % args)

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("request body too large")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    # --- routes ------------------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            return self._send_json(200, {
                "status": "ok",
                "engine": engine_name(),
                "azure_configured": azure_configured(),
            })
        if path == "/api/sample":
            return self._handle_sample()
        return self._serve_static(path)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        try:
            payload = self._read_json()
        except ValueError as exc:
            return self._send_json(400, {"error": str(exc)})

        try:
            if path == "/api/prepare":
                return self._handle_prepare(payload)
            if path == "/api/review":
                return self._handle_review(payload)
        except ValueError as exc:
            return self._send_json(400, {"error": str(exc)})
        except Exception as exc:  # keep the demo alive on unexpected input
            log.exception("unhandled error on %s", path)
            return self._send_json(500, {"error": "{}: {}".format(type(exc).__name__, exc)})

        self._send_json(404, {"error": "unknown endpoint {}".format(path)})

    # --- handlers ----------------------------------------------------------
    def _handle_prepare(self, payload: Dict[str, Any]) -> None:
        portfolio = str(payload.get("portfolio", "")).strip()
        job_description = str(payload.get("job_description", "")).strip()
        if not portfolio or not job_description:
            raise ValueError("both 'portfolio' and 'job_description' are required")
        session = run(
            portfolio,
            job_description,
            question_count=int(payload.get("question_count", 8)),
        )
        self._send_json(200, session.to_dict())

    def _handle_review(self, payload: Dict[str, Any]) -> None:
        transcript = str(payload.get("transcript", "")).strip()
        if not transcript:
            raise ValueError("'transcript' is required")
        portfolio = str(payload.get("portfolio", "")).strip()
        job_description = str(payload.get("job_description", "")).strip()
        if not portfolio or not job_description:
            raise ValueError("'portfolio' and 'job_description' are required for review")
        session = run(
            portfolio,
            job_description,
            transcript_text=transcript,
            transcript_format=str(payload.get("transcript_format", "auto")),
            question_count=int(payload.get("question_count", 8)),
            interview_date=payload.get("interview_date"),
        )
        self._send_json(200, session.to_dict())

    def _handle_sample(self) -> None:
        try:
            session = run(
                _read_sample("portfolio_priya_raman.md"),
                _read_sample("job_description_senior_backend.md"),
                transcript_text=_read_sample("interview_priya_raman.vtt"),
                question_count=8,
                interview_date="2026-07-29",
            )
        except OSError as exc:
            return self._send_json(500, {"error": "sample data unavailable: {}".format(exc)})
        payload = session.to_dict()
        payload["inputs"] = {
            "portfolio": _read_sample("portfolio_priya_raman.md"),
            "job_description": _read_sample("job_description_senior_backend.md"),
            "transcript": _read_sample("interview_priya_raman.vtt"),
        }
        self._send_json(200, payload)

    # --- static ------------------------------------------------------------
    def _serve_static(self, path: str) -> None:
        if path in ("/", ""):
            path = "/index.html"
        # Normalise and confine to WEB_ROOT; no traversal above the web dir.
        relative = posixpath.normpath(path).lstrip("/")
        full = os.path.normpath(os.path.join(WEB_ROOT, relative))
        if not full.startswith(WEB_ROOT + os.sep) and full != WEB_ROOT:
            return self._send_json(403, {"error": "forbidden"})
        if not os.path.isfile(full):
            return self._send_json(404, {"error": "not found"})

        extension = os.path.splitext(full)[1].lower()
        with open(full, "rb") as handle:
            body = handle.read()
        self._send(200, body, CONTENT_TYPES.get(extension, "application/octet-stream"))


def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    httpd = ThreadingHTTPServer((host, port), GhostHandler)
    engine = engine_name()
    print("Ghost dashboard: http://{}:{}".format(host, port))
    print("Generation engine: {}".format(engine))
    if engine == "offline":
        print("  (set AZURE_OPENAI_ENDPOINT / _API_KEY / _DEPLOYMENT to use Azure OpenAI)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Run the Ghost interviewer dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    serve(args.host, args.port)
