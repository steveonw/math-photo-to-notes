# AI Handoff Sheet — Math Photo to Notes

## Project

Browser-based bulk photo-to-text transcription and review tool for handwritten and printed notes, with special support for math-heavy material.

Main application:

`photo_to_text.html`

Related repositories that informed the design:

- `steveonw/study-suite` — original photo-to-text workflow
- `steveonw/equationwright` — deterministic math validation / LaTeX safety ideas
- other `steveonw` projects — traceability, diagnostics, selective recomputation, persistence, and review-workflow ideas

The repository owner has explicitly permitted reuse of code and patterns from these repositories.

---

# Current Status

As of 2026-09-30, the project has completed the roadmap through **Upgrade 7**.

Implemented:

- Phase A reliability foundation
- Phase A2 reliability hardening core
- live MathJax math review
- guided human review
- durable concurrent batch queue
- pause/resume/cancel
- transient retry/backoff
- persistent document/notebook organization
- stable page ordering and drag/drop
- page metadata and page-number suggestions
- document-scoped review and export groundwork

The next active milestone is:

## Upgrade 8 — Automatic Primary / Secondary Routing

Build automatic post-classification routing on top of the hardened queue engine.

Requirements:

- opt-in automation
- independent per-pile Primary/Secondary choice
- maximum AI-attempt limits
- no retry loops
- queue-aware routing
- visible routing/retry history
- Approved pages remain protected
- Needs Reapproval is never auto-approved
- explicit fresh-vs-cache behavior remains controllable

---

# Core Design Principles

1. **Never silently replace uncertainty with confidence.**
2. **Never destroy a useful earlier result.**
3. **Never recompute more than necessary.**
4. Deterministic application code owns state, validation, caching, routing, and persistence.
5. AI is used for vision/language judgment, not for application control flow.
6. Human approval is the final gate for finished transcription.

If a mathematical interpretation is uncertain, keep that uncertainty visible.

Required uncertainty form:

`[MATH_UNSURE: seen="..." guess="..." note="..."] (I think it says: ...)`

---

# Current Processing States

The application currently uses:

- Queued
- Running
- Interrupted
- Good
- Review
- Unclear
- Math Unsure
- Failed
- Approved
- Needs Reapproval

## Queued

Waiting for processing.

## Running

Currently assigned to an active AI request.

## Interrupted

Processing was cancelled, timed out repeatedly, interrupted by reload, or exhausted transient retries.

Interrupted means the page is safe to resume. It is not evidence of a bad transcription.

## Good

No current automatic warning signals.

## Review

Transcription succeeded but has warning signs such as suspicious formatting, truncation, or other quality concerns.

## Unclear

The transcription contains explicit unreadable ordinary text.

Markers include:

`[unclear]`

and:

`[No readable text found]`

## Math Unsure

There is explicit or detected mathematical ambiguity.

## Failed

A non-transient provider/API/configuration error prevented a usable transcription.

Temporary network/provider/rate-limit errors should not be sent directly to Failed.

## Approved

Human-reviewed final transcription.

Approved pages are excluded from automatic/retry processing unless explicitly unlocked or changed.

## Needs Reapproval

A page was previously Approved but its final transcription changed, or review state was added afterward.

It must not silently remain Approved.

---

# Primary / Secondary AI

There are two independently configurable AI slots.

Each stores:

- provider
- model
- compatible base URL where required
- prompt
- per-pile routing selection

API keys are intentionally not persisted.

Supported provider modes currently include:

- OpenAI
- Anthropic
- Google Gemini
- OpenAI-compatible endpoints

The provider capability registry records known support for:

- image input
- truncation metadata
- usage metadata
- cancellation
- compatible-endpoint caveats

Do not assume all OpenAI-compatible endpoints behave identically.

---

# Per-Pile AI Routing

Current selectors allow independent routing for:

- Current pile
- Review
- Unclear
- Math Unsure
- Failed

Each can use Primary or Secondary.

These choices persist locally.

Automatic post-classification rerouting is still a later milestone and must use retry limits and the hardened queue engine.

---

# Version Preservation

Every page maintains separate transcription versions:

1. raw AI transcription
2. mechanically repaired transcription
3. final human-editable transcription

Retries and important edits preserve previous revisions.

Current controls include:

- View raw
- View repaired
- View final
- Compare versions
- Restore previous

Revision/provenance data includes, where available:

- provider
- model
- pass
- classification
- repair information
- validation warnings
- truncation metadata
- attempt history

Do not replace this model with a single mutable text field.

---

# Persistence / Recovery

Current durable storage design:

- IndexedDB stores full project/page state and image data
- localStorage stores lightweight fallback state and UI/config preferences
- API keys are never stored
- project schema is currently:

`math-photo-notes-project-v1`

Running work is normalized to Interrupted/Pending when restored.

A persisted queue can be resumed after reload once the relevant API key is re-entered.

Corrupt or incompatible saved state should be preserved for recovery rather than silently overwritten.

Future schema versions should use explicit migration logic.

---

# Image and Processing Fingerprints

Images may receive SHA-256 hashes using Web Crypto.

Processing fingerprints are based on relevant request inputs such as:

- image hash
- provider
- model
- base URL
- prompt

These support:

- exact duplicate detection groundwork
- request provenance
- result caching
- avoiding unnecessary recomputation

Explicit fresh retries must be able to bypass cached results.

---

# Content-Addressed Result Cache

Successful AI results can be cached by processing fingerprint in IndexedDB.

Cached results preserve:

- raw transcription
- provider/model
- stop reason
- usage metadata when available
- timestamp

The cache must never turn an explicitly requested fresh retry into a cached replay.

---

# Durable Queue / Batch Engine

Upgrade 6 introduced a persisted ordered queue.

Current behavior:

- configurable concurrency from 1–6
- default concurrency: 2
- Pause stops new launches but allows active requests to finish
- Resume continues pending jobs
- Cancel aborts active requests
- cancelled pages become Interrupted
- queue order is persisted
- restored queues come back paused
- a saved queue cannot be overwritten by starting another queue

The queue is application state, not just a temporary `for` loop.

---

# Transient Retry / Backoff

Transient errors include:

- HTTP 408
- HTTP 409
- HTTP 425
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504
- network failures
- request timeout

Current policy:

- maximum automatic transient retries: 3
- normal base delay: 2 seconds
- exponential backoff
- delay cap
- honor `Retry-After` when supplied
- preserve transient retry history

If transient failures persist after the retry budget, move the page to Interrupted rather than Failed.

Authentication/configuration errors such as HTTP 401 are not transient.

---

# Request Identity / Cancellation Safety

Each AI attempt gets a unique attempt ID.

Requirements already implemented:

- `AbortController`
- request timeout
- stale-result guard
- Cancel Request
- Cancel Batch
- duplicate in-flight protection

A response from an obsolete attempt must never overwrite newer work.

Do not remove this protection when adding more concurrency or automatic routing.

---

# Math Handling Rules

Prefer LaTeX for mathematical notation.

Preserve:

- fractions
- radicals
- exponents
- subscripts
- Greek letters
- derivatives
- partial derivatives
- integrals
- sums
- limits
- matrices
- vectors
- piecewise functions
- aligned equations
- bounds

Do not silently infer mathematical structure from ambiguous marks.

---

# Safe LaTeX Repair

Safe mechanical transformations are allowed.

Examples include:

- Unicode minus → ASCII minus
- `×` → `\times`
- `π` → `\pi`
- `∞` → `\infty`
- `≤` → `\le`
- `≥` → `\ge`
- safe delimiter cleanup
- obvious missing command backslashes inside known math spans
- control-character cleanup

Unsafe semantic transformation is forbidden.

Permanent regression case:

`√x`

must never be blindly rewritten as:

`\sqrt{}x`

If radical scope is unclear:

- preserve source
- warn
- route toward Math Unsure where appropriate

---

# Math Validation

The application currently performs deterministic structural validation.

Checks include:

- unmatched braces
- unmatched `\(` / `\)`
- unmatched `\[` / `\]`
- unmatched `$$`
- malformed `\frac`
- malformed `\sqrt`
- incomplete superscripts/subscripts
- suspicious integral bounds
- mismatched environments
- suspicious missing command backslashes
- Unicode radical warnings

Validation now produces structured warning categories and approximate source snippets.

Repairs and warnings are distinct:

### Repair

Mechanically safe transformation.

### Warning

Possible semantic/math problem needing review.

Warnings must never silently rewrite uncertain mathematics.

---

# MathJax / Live Preview

The application now provides live source + rendered MathJax preview.

Current implementation loads MathJax on demand for live preview and also uses a detached print/PDF window for export.

Important security follow-up:

The older handoff prohibited all remote MathJax loading on the main API-key page. Upgrade 4 introduced on-demand main-page loading for live preview. Before treating this as production-hardened, strongly consider bundling/self-hosting MathJax or otherwise eliminating reliance on third-party remote script execution on a page where API keys may be entered.

Regardless of renderer behavior:

- source transcription stays authoritative
- render failure must not delete source
- render problems push toward Math Unsure/review

---

# Guided Human Review

Upgrade 5 added Guided Review.

Current capabilities:

- one-page-at-a-time review
- previous/next navigation
- side-by-side image/transcription layout
- image zoom
- fit page
- fit width
- 90-degree rotation
- keyboard shortcuts

Keyboard shortcuts:

- `A` → Approve
- `R` → Review
- `U` → Unclear
- `M` → Math Unsure
- `1` → fresh Primary retry
- `2` → fresh Secondary retry
- Left/Right arrows → navigate
- Escape → leave Guided Review

---

# Anchored Review Flags

A reviewer may select final transcription text and attach a flag/note.

Flags store:

- selected text
- approximate character range
- note
- timestamp
- attached/detached state

After edits, the application attempts to re-anchor the flag by matching its selected text near the prior location.

If the text can no longer be found, the flag becomes Detached instead of being silently discarded.

Adding a review flag to an Approved page triggers Needs Reapproval.

---

# Approval Rules

Approval is revision-sensitive.

Approved means:

- human reviewed
- current final transcription accepted
- excluded from automatic retry
- ready for final export

Any material final-text edit after approval must change the page to:

`Needs Reapproval`

Viewing, zooming, or rotating the image does not invalidate approval because those actions do not change transcription content.

---

# Document Organization / Page Ordering

Upgrade 7 added a persistent organization layer.

Current capabilities:

- named document / notebook groups
- Unfiled pages
- document filter
- per-page document assignment
- stable page order persisted with the project
- drag-and-drop page reordering
- document-scoped Guided Review navigation
- document-specific Markdown export
- document-specific PDF export

Per-page metadata currently includes:

- title
- class
- chapter
- lecture
- date
- page number
- tags

Page-number suggestions are deterministic and non-destructive.

Suggestion sources currently include:

- explicit page-like filename patterns
- numeric filename endings
- transcription labels such as `Page 12`
- isolated numeric lines near the beginning/end of a transcription

A suggestion must never silently overwrite metadata or reorder pages.

Users may:

- accept one suggestion
- dismiss one suggestion
- explicitly apply available suggestions in the current document

Changing organization metadata does not by itself invalidate transcription approval because it does not alter the final transcription text.

Page ordering is represented by stable persisted item order. Queue processing follows the item order supplied when a queue is created, while a running durable queue retains its own job order.

---

# Doctor / Diagnostics

The application includes a Doctor report.

It currently checks/reports:

- project schema
- IndexedDB availability
- storage estimate where available
- Web Crypto availability
- AbortController
- request timeout
- concurrency
- transient retry limit
- durable queue state
- cached result count
- interrupted job count
- A2 self-tests
- Primary/Secondary provider/model
- API-key presence without displaying the key
- provider capability notes

Diagnostics should remain action-oriented.

---

# Known Bugs / Regressions That Must Not Return

1. Math Unsure prompt instructions disappearing.
2. stale localStorage prompts overriding a newer default unexpectedly.
3. `√x → \sqrt{}x` semantic corruption.
4. repair logic running outside known math spans.
5. retries destroying earlier transcriptions.
6. Process Batch reprocessing completed questionable pages unintentionally.
7. Current-pile retry being hard-coded to Primary.
8. stale AI responses overwriting newer attempts.
9. transient 429/5xx/timeouts being treated as transcription failure.
10. a restored queue being overwritten by starting another queue.
11. Approved pages remaining Approved after transcription edits.
12. review flags disappearing silently after text edits.
13. API keys being written into saved projects.
14. page-number suggestions silently overwriting manual metadata.
15. page-number suggestions automatically reordering pages.
16. document filtering breaking Guided Review navigation.
17. stale duplicated HTML being appended after the canonical closing document.

---

# Current Roadmap

## Completed / substantially implemented

### Upgrade 1 — Phase A
- Approved
- raw/repaired/final versions
- revision history
- truncation detection
- retry counters
- safer LaTeX validation
- baseline autosave

### Upgrade 2 — Phase A2
- project schema
- IndexedDB
- fallback recovery
- provider capability registry
- Doctor diagnostics

### Upgrade 3 — Phase A2 continuation
- request identity
- cancellation
- timeout
- stale-result guards
- Interrupted state
- image/process fingerprints
- exact-result cache
- initial self-tests

### Upgrade 4 — Math Review
- live MathJax preview
- structured validation
- Math Unsure parsing/display
- math-warning categories

### Upgrade 5 — Human Review
- guided review
- side-by-side layout
- zoom/rotation/fit
- keyboard shortcuts
- anchored review flags
- Needs Reapproval

### Upgrade 6 — Batch Queue
- durable ordered queue
- concurrency
- pause/resume
- cancellation
- transient retries
- Retry-After
- exponential backoff

### Upgrade 7 — Document Organization + Page Ordering
- persistent document/notebook groups
- Unfiled pages
- stable persisted order
- drag-and-drop reordering
- title/class/chapter/lecture/date/page/tags metadata
- non-destructive page-number suggestions
- explicit accept/dismiss/apply suggestion controls
- document-scoped Guided Review
- document Markdown/PDF export groundwork

## Next

### Upgrade 8
Automatic Primary/Secondary routing using the hardened queue engine.

Required protections:

- opt-in automation
- per-pile routing remains independent
- bounded attempts
- no recursive retry loops
- preserve queue durability
- preserve revision history
- protect Approved pages

## Later

### Upgrade 9
Equation/region-only retries, model-disagreement review, dependency tracking, Needs Refresh.

### Upgrade 10
Full project/archive export, portable review packages, cost/usage reporting.

---

# Desired Long-Term Workflow

`Import → organize → fingerprint → Primary AI/cache → classify → safe repair/validate → targeted retry → guided human review → Approved → export/archive`

The original image, processing provenance, raw AI response, repair history, review flags, retry history, earlier revisions, and approval lineage should remain recoverable.

---

# Development Constraint

Prefer incremental upgrades over broad rewrites.

Each upgrade should:

1. preserve existing behavior unless intentionally superseded
2. add one coherent capability
3. keep state backward-compatible where practical
4. be syntax-checked after modification
5. preserve mathematical meaning
6. avoid destroying history
7. retain safe recovery after interruption
8. update this handoff and the upgrade plan when architecture changes materially
