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

**High Assurance Math** is shown as a disabled future option and is not active yet.

## Current capabilities

- Primary and Secondary vision-AI configurations
- durable concurrent batch queue with pause/resume/cancel and transient retry/backoff
- Good / Review / Unclear / Math Unsure / Approved / Needs Reapproval / Needs Refresh / Failed / Interrupted states
- raw / repaired / final transcription lineage and revision history
- conservative LaTeX repair plus deterministic validation
- live MathJax review and PDF export
- guided human review, anchored flags, and keyboard workflow
- document/notebook organization, metadata, page ordering, and page-number suggestions
- optional bounded automatic Primary/Secondary routing
- targeted equation/region crop retries and model-disagreement review
- versioned project Save/Open
- project archive ZIP, page/region review-package ZIPs, and external-AI round-trip review packages
- tolerant external correction import with mandatory diff / Accept / Reject / Edit
- Markdown/plain-text/LaTeX/PDF exports
- provenance/audit and usage/cost reports

## Main file

Open:

`photo_to_text.html`

in a modern browser.

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

## Project docs

- [Upgrade Plan](UPGRADE_PLAN.md)
- [AI Handoff Sheet](AI_HANDOFF.md)

## Core design principles

Never silently replace uncertainty with confidence.

Never destroy a useful earlier result.

Never recompute more than necessary.

A successful provider response must be preserved before any local repair, validation, classification, or rendering step. Safe mechanical repairs may be applied automatically; ambiguous mathematical content should remain visibly uncertain and be routed to human review rather than guessed.

## Status

The numbered Upgrade 1–10 roadmap is complete. Current work is hardening, regression coverage, and optional high-accuracy workflows.
