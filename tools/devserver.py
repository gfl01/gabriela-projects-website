#!/usr/bin/env python3
"""Local dev server that mirrors how Cloudflare serves this site.

Production serves extensionless URLs (/portfolio, not /portfolio.html) and a
custom 404 page. Plain `python3 -m http.server` does neither, so every internal
link 404s locally. This keeps local preview honest.

Usage: python3 tools/devserver.py [port]   (default 8080)
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class SiteHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        # /portfolio -> /portfolio.html, when the bare path isn't a real file
        if not os.path.exists(local) and not path.rstrip("/").endswith(".html"):
            candidate = local.rstrip("/") + ".html"
            if os.path.isfile(candidate):
                return candidate
        return local

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            page = os.path.join(ROOT, "404.html")
            if os.path.isfile(page):
                body = open(page, "rb").read()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(SiteHandler, directory=ROOT)
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {ROOT} on http://localhost:{port} (clean URLs + 404 page)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
