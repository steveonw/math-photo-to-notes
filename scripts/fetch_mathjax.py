#!/usr/bin/env python3
"""Fetch the exact MathJax tex-svg browser bundle used by the offline builder.

This mirrors the proven EquationWright offline-build pattern, but pins the
bundle to MathJax 3.2.2 and verifies the exact Git blob identity before use.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://raw.githubusercontent.com/mathjax/MathJax/3.2.2/es5/tex-svg.js"
EXPECTED_GIT_BLOB_SHA1 = "aed2086b6c27920ec2c15399cf6d773b33c892b3"


def git_blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    h = hashlib.sha1()
    h.update(f"blob {len(data)}\0".encode("ascii"))
    h.update(data)
    return h.hexdigest()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=DEFAULT_URL)
    p.add_argument("--output", default="vendor/mathjax/tex-svg.js")
    p.add_argument("--expected-git-blob", default=EXPECTED_GIT_BLOB_SHA1)
    p.add_argument("--force", action="store_true")
    args = p.parse_args()

    out = Path(args.output)
    expected = (args.expected_git_blob or "").lower().strip()

    if out.exists() and not args.force:
        actual = git_blob_sha1(out)
        if expected and actual != expected:
            print(f"ERROR: existing {out} has Git blob SHA-1 {actual}, expected {expected}", file=sys.stderr)
            return 2
        print(f"exists: {out} ({out.stat().st_size:,} bytes; git-blob-sha1={actual})")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".part")
    print(f"downloading {args.url}")
    try:
        with urllib.request.urlopen(args.url, timeout=60) as response, tmp.open("wb") as f:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                f.write(block)
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    actual = git_blob_sha1(tmp)
    if expected and actual != expected:
        tmp.unlink(missing_ok=True)
        print(f"ERROR: Git blob SHA-1 mismatch: {actual} != {expected}", file=sys.stderr)
        return 2

    tmp.replace(out)
    print(f"wrote {out} ({out.stat().st_size:,} bytes; git-blob-sha1={actual})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
