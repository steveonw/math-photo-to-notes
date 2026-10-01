# Math Photo to Notes

A browser-based bulk photo-to-text transcription and human-review tool for handwritten and printed notes, with special support for mathematical notation.

This project is based on the photo-to-text workflow from `steveonw/study-suite` and incorporates deterministic math/LaTeX ideas from `steveonw/equationwright`.

## Current workflow

The default path is now **Quick Transcribe**:

`Import → Process Batch → preserve raw → repair/validate → sort into piles → Batch Summary`

Quick Transcribe uses one Primary semantic transcription pass per page. Optional **Auto-fix flagged pages** enables the existing bounded second-pass routing for Review / Unclear / Math Unsure / eligible Failed pages. Guided Review is a post-processing action rather than a separate processing mode.

At the end of a run, the dashboard can open flagged pages in Guided Review, resume Interrupted pages, retry eligible Failed pages, or export the project. **Good means no automatic warning signals were detected; it does not mean independently verified.**

Release B adds **Good-page spot checks**. A completed batch can randomly sample 1, 5, 10, or 20 Good pages for source-image review. Human outcomes are recorded as OK or Error found, with optional error category/note. Error-found pages move to Review without changing their transcription. The persistent reliability ledger records model, prompt fingerprint, processing fingerprint, image/final-text hashes, and batch settings; the UI reports only human-reviewed counts, not a formal accuracy percentage.

Release C adds **Review with External AI** as a full export/import round trip. Problem pages are packaged in 5/10/20-page chunks with source images, stable IDs, transcriptions, warnings, a ready-made prompt, and an exact return template. Returned AI text is treated only as a proposal: tolerant import reports unknown/duplicate/malformed/missing pages, then requires a source/current/proposed diff review before Accept / Reject / Edit. Accepted changes preserve revision/provenance and Approved lineage; external AI can never approve or directly classify a page.

Post-Release-C hardening makes math returns **LaTeX-safe**. The preferred external-AI response is now a plain `=== PAGE ... ===` block format, so commands such as `\frac`, `\theta`, and `\neq` do not pass through JSON escape semantics. JSON remains a fallback, but unsafe single-backslash LaTeX is rejected instead of silently corrupted. External review can be exported either as a ZIP or as **Loose images + text** for direct chat upload. The spot-check reliability ledger is also stored separately in IndexedDB and survives **Clear all** and reload; project files carry a portable snapshot that merges into the global ledger.

Release D activates **High Assurance Math** as an optional, off-by-default independent verification layer for Good pages. The default **Math-heavy only** policy uses deterministic notation signals to decide which otherwise-Good pages receive one fresh Secondary re-read. **Any detected math** and **All Good pages** policies are also available. The verifier reads the original image without being shown the Primary transcription. Agreement is preserved as verification evidence; disagreement keeps the Primary text, stores the Secondary reading, and moves the page to Review with no automatic winner. High Assurance disagreement does not continue into Auto-fix.

Release E hardens the infrastructure underneath that workflow: targeted-region work is durably resumable, project files use explicit v1→v2 migrations, browser regressions have a checked-in fixture corpus, large archives have a compressed/memory-aware path, and image-review assistance remains evidence-driven and non-destructive. MathJax now uses pinned 3.2.2 SVG rendering in both editions: the normal app loads the local `vendor/mathjax/tex-svg.js` bundle, while the EquationWright-style **single-file offline build** embeds that same bundle inline.

## Current capabilities

- Primary and Secondary vision-AI configurations
- durable concurrent batch queue with pause/resume/cancel and transient retry/backoff
- Good / Review / Unclear / Math Unsure / Approved / Needs Reapproval / Needs Refresh / Failed / Interrupted states
- raw / repaired / final transcription lineage and revision history
- conservative LaTeX repair plus deterministic validation
- fully local pinned MathJax 3.2.2 SVG live review and PDF export
- reproducible one-file offline build with embedded pinned MathJax tex-svg
- guided human review, anchored flags, and keyboard workflow
- document/notebook organization, metadata, page ordering, and page-number suggestions
- optional bounded automatic Primary/Secondary routing
- optional High Assurance verification of otherwise-Good pages with deterministic math triggers, independent Secondary re-read, visible added usage/cost, and disagreement → Review
- targeted equation/region crop retries and model-disagreement review
- durable targeted-region queue persistence across reload/resume
- explicit versioned project-schema migrations and checked-in regression fixtures
- compressed/memory-aware large project archives
- evidence-driven non-destructive image review assist
- versioned project Save/Open
- project archive ZIP, page/region review-package ZIPs, and external-AI round-trip review packages
- tolerant external correction import with mandatory diff / Accept / Reject / Edit
- Markdown/plain-text/LaTeX/PDF exports
- provenance/audit and usage/cost reports

## Main file

Open:

`photo_to_text.html`

in a modern browser.

## Single-file offline build

For a one-file edition with MathJax embedded inline:

```bash
python3 scripts/fetch_mathjax.py
python3 make_offline_build.py
```

This produces:

`photo_to_text_OFFLINE.html`

The fetch helper pins MathJax 3.2.2 `tex-svg.js` and verifies the exact Git blob SHA before the builder embeds it. The generated file needs no MathJax network request or companion MathJax folder. Live preview uses embedded SVG MathJax, and PDF/print export reuses the same embedded engine.

## Testing

The repository includes a browser regression suite in:

`tests/browser-smoke.mjs`

GitHub Actions runs it through Playwright/Chromium on every push to `main` and on pull requests.

The browser suite must exercise the real standalone page, not only parse its JavaScript. It currently covers:

- the built-in deterministic self-tests
- math repair cases such as `$x^2$`, `$√x$`, `$frac{1}{2}$`, `$sqrt{x}$`, `$theta_1$`, and `$sin(x)$`
- a mocked provider response containing LaTeX through the normal Process Batch UI
- preservation of a successful raw provider result when local post-processing throws
- Gemini authentication via the `x-goog-api-key` header rather than the request URL
- Good-page spot-check persistence and human-found error handling
- external-AI package contract, tolerant import parsing, mandatory diff, accept/reject behavior, and Approved → Needs Reapproval lineage
- High Assurance deterministic math triggers, formatting-only normalization, independent agreement, sign-level disagreement, Primary-text preservation, no automatic winner, usage/provenance visibility, and no Auto-fix continuation after disagreement
- durable targeted-region/migration fixture behavior, archive hardening, and image-review-assist evidence gates
- local pinned MathJax `tex-svg.js` rendering with no remote executable script
- generated one-file offline `tex-svg` edition through the same full Chromium smoke suite

## Project docs

- [Upgrade Plan](UPGRADE_PLAN.md)
- [AI Handoff Sheet](AI_HANDOFF.md)

## Core design principles

Never silently replace uncertainty with confidence.

Never destroy a useful earlier result.

Never recompute more than necessary.

A successful provider response must be preserved before any local repair, validation, classification, or rendering step. Safe mechanical repairs may be applied automatically; ambiguous mathematical content should remain visibly uncertain and be routed to human review rather than guessed.

## Status

The numbered Upgrade 1–10 roadmap and Releases A–E are complete. Current work is evidence-driven maintenance, regression expansion, bug fixing, and product refinement rather than a new numbered release.
