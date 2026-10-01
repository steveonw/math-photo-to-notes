#!/usr/bin/env python3
"""Build a single-file offline edition with MathJax tex-svg-full embedded inline.

Uses an EquationWright-inspired single-file packaging approach, but Photo to Notes
intentionally embeds the broader pinned tex-svg-full.js bundle. The normal app loads
that same local bundle; this builder injects it before the main app script so live
preview and PDF export reuse the same runtime without network access or companion folders.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

EXPECTED_GIT_BLOB_SHA1 = "b3388d20a8d2773b001eebd3211ef1a337335d67"
MAIN_SCRIPT_MARKER = "<script>\nconst PROVIDERS"


def git_blob_sha1_bytes(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(f"blob {len(data)}\0".encode("ascii"))
    h.update(data)
    return h.hexdigest()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("app", nargs="?", default="photo_to_text.html")
    p.add_argument("mathjax", nargs="?", default="vendor/mathjax/tex-svg-full.js")
    p.add_argument("--output")
    p.add_argument("--skip-hash-check", action="store_true")
    args = p.parse_args()

    app_path = Path(args.app)
    mj_path = Path(args.mathjax)
    if not app_path.exists():
        print(f"ERROR: missing app: {app_path}", file=sys.stderr)
        return 2
    if not mj_path.exists():
        print(
            f"ERROR: missing MathJax bundle: {mj_path}\n"
            "Run: python scripts/fetch_mathjax.py",
            file=sys.stderr,
        )
        return 2

    src = app_path.read_text(encoding="utf-8")
    bundle_bytes = mj_path.read_bytes()
    actual = git_blob_sha1_bytes(bundle_bytes)
    if not args.skip_hash_check and actual != EXPECTED_GIT_BLOB_SHA1:
        print(
            f"ERROR: MathJax bundle Git blob SHA-1 {actual} does not match "
            f"pinned {EXPECTED_GIT_BLOB_SHA1}",
            file=sys.stderr,
        )
        return 3

    if 'id="embedded-mathjax-source"' in src:
        print("ERROR: app already contains an embedded MathJax bundle", file=sys.stderr)
        return 4

    marker = src.find(MAIN_SCRIPT_MARKER)
    if marker < 0:
        print("ERROR: main app script marker not found", file=sys.stderr)
        return 5

    bundle = bundle_bytes.decode("utf-8")
    bundle = re.sub(r"</script", r"<\\/script", bundle, flags=re.I)

    config = """<script>
window.MathJax={
  tex:{
    inlineMath:[['\\\\(','\\\\)'],['$','$']],
    displayMath:[['\\\\[','\\\\]'],['$$','$$']],
    processEscapes:true,
    packages:{'[-]':['html','noundefined','require']}
  },
  svg:{fontCache:'global'},
  options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']}
};
</script>
"""
    embedded = (
        config
        + '<script id="embedded-mathjax-source">\n'
        + "/* MathJax 3.2.2 tex-svg-full EMBEDDED for the offline edition. */\n"
        + bundle
        + "\n</script>\n"
    )

    out = src[:marker] + embedded + src[marker:]
    out = out.replace(
        "<title>Math Photo to Notes</title>",
        "<title>Math Photo to Notes — Offline</title>",
        1,
    )

    dest = Path(args.output) if args.output else app_path.with_name(app_path.stem + "_OFFLINE.html")
    dest.write_text(out, encoding="utf-8")
    print(
        f"wrote {dest} ({dest.stat().st_size:,} bytes; "
        f"MathJax git-blob-sha1={actual})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
