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

As of 2026-09-30, the project has completed the numbered roadmap through **Upgrade 10**.

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
- document-scoped review/export groundwork
- opt-in automatic Primary/Secondary routing
- bounded routing attempts and loop prevention
- routing history and queue-safe mixed-AI jobs
- targeted equation/region crop retries
- Primary/Secondary crop comparison
- region-level provenance and dependency tracking
- Needs Refresh workflow for stale downstream page text
- explicit versioned project Save/Open
- portable project ZIP archive
- page and region review-package ZIPs
- Markdown/plain-text/LaTeX export expansion
- usage normalization and user-rate cost estimates
- provenance/audit manifest

The numbered Upgrade 1–10 roadmap is complete.

## Critical math-path hotfix — 2026-09-30

A headless-browser review exposed a release-blocking bug in the dynamic missing-backslash repair regex inside `repairMathSpan`.

The over-escaped `RegExp` constructor threw `Unterminated group` on the first recognized math span. This meant otherwise successful provider responses containing delimited math could be misreported as Failed.

The hotfix changed the engineering contract in addition to fixing the two escaping lines:

- the dynamic repair regex now compiles correctly
- restored LaTeX commands insert exactly one backslash
- successful provider raw text is assigned to the page before repair/validation/classification
- successful raw text is written to the exact-result cache before post-processing
- usage/provenance is recorded before post-processing
- a local repair/validator exception produces **Review**, not Failed
- the raw provider result becomes the visible final fallback when local post-processing fails
- automatic AI rerouting is blocked for a local post-processing error so a code bug does not cause another paid request
- Gemini authentication uses the `x-goog-api-key` header instead of a `?key=` URL parameter
- remote MathJax is pinned to `3.2.2` rather than the floating `@3` tag
- `.github/workflows/browser-smoke.yml` now runs browser regression tests on pushes to main and pull requests
- `tests/browser-smoke.mjs` executes the built-in self-tests, a mocked math transcription through the normal batch UI, a forced post-processing crash, and Gemini-auth request inspection

This hotfix reinforces the core rule:

**A paid/successful provider response is evidence and must be preserved before any local transformation can fail.**

Recommended remaining work is now a hardening / optional backlog rather than an undefined Upgrade 11:

- durable queue support for in-flight targeted-region requests
- explicit future project-schema migrations
- larger checked-in regression fixture corpus
- self-host/bundle MathJax instead of remote main-page script loading
- optional independent Math Verifier workflow
- very-large-project archive streaming/compression improvements

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
- Needs Refresh

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

## Needs Refresh

A targeted region result has been explicitly selected as preferred, but the linked final transcription does not yet reflect that result.

Needs Refresh means:

- targeted evidence changed
- downstream page text remains stale
- the page text has not been overwritten automatically
- a human must either apply the preferred targeted result or explicitly keep the current page text

Approved pages entering Needs Refresh retain invalidated-approval lineage and require reapproval after the dependency is resolved.

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

Automatic post-classification rerouting is implemented in Upgrade 8 and uses the hardened durable queue.

Automatic routing remains opt-in and uses these existing independent selectors rather than introducing a second routing configuration.

---

# Automatic Primary / Secondary Routing

Upgrade 8 added opt-in automatic post-classification routing.

Automatic routing is **off by default**.

Eligible result classifications:

- Review
- Unclear
- Math Unsure
- selected Failed cases

Good stops automatically.

Approved and Needs Reapproval are protected from automatic routing.

## Routing controls

Current controls include:

- Auto-route problem results checkbox
- maximum processing attempts per page: 2–4
- automatic retry policy:
  - Fresh AI call
  - Allow exact cache
- existing independent Review / Unclear / Math Unsure / Failed Primary/Secondary selectors

Default maximum is 2 total processing attempts per page.

## Queue behavior

Automatic routes are appended as new durable queue jobs.

They are not recursive calls.

Each queued route records its own:

- page ID
- Primary/Secondary pass
- provider/model at execution
- source classification
- routing reason
- fresh/cache policy
- timestamps/outcome

Mixed Primary and Secondary jobs can coexist in one durable queue.

Restored queues keep each job's AI pass.

If a pending routed job requires an API key/configuration that is not currently available, the queue pauses instead of failing the transcription.

After credentials are entered, Resume continues the queue.

## Loop prevention

Every automatic route uses a signature:

`classification → AI slot`

The same automatic route signature is not queued twice for the same page.

Automatic routing also stops when the configured maximum total processing attempts has been reached.

This prevents loops such as:

`Review → Secondary → Review → Secondary → ...`

A new classification may route differently if there is still attempt budget and that route signature has not already been used.

## Failed routing

Non-transient Failed results may be routed when appropriate.

Clear configuration/authentication failures do not automatically retry the same AI slot.

They may route to the alternate AI slot if the user explicitly selected that alternate slot for Failed.

Missing original image data is never considered recoverable through automatic AI routing.

Transient network/rate-limit/timeout failures continue to use the Upgrade 6 backoff system and become Interrupted after exhaustion rather than entering automatic Failed routing.

## Disabling automation

Turning automatic routing off:

- stops creation of new automatic routes
- cancels pending not-yet-started automatic route jobs
- does not kill a currently running request
- preserves routing history

## Routing history

Each page retains visible automatic routing history.

Events include:

- queued
- completed
- stopped
- cancelled

Reasons include maximum-attempt stop, repeated-route prevention, approval protection, and configuration limits.

Automatic routing never performs human approval.

---

# Targeted Region / Equation Review

Upgrade 9 added targeted crop reprocessing.

## Creating a targeted region

Use **Target region** from a page image.

The crop picker uses the original unrotated source image.

A region stores normalized crop coordinates:

- x
- y
- width
- height

and a crop hash when Web Crypto is available.

If the reviewer selects final-transcription text before opening the crop picker, the new region is linked to that text range as a downstream dependency.

A region may also be created without a text link; in that case it serves as review evidence only.

## Region retries

Each saved region can run:

- Primary targeted retry
- Secondary targeted retry
- Primary + Secondary comparison

Targeted retries use the same provider adapters, request timeout, cancellation, and transient retry/backoff behavior as whole-page transcription.

They do not increment whole-page Primary/Secondary attempt counters.

Targeted work currently requires the whole-page batch queue to be idle.

Completed targeted results persist with the project; an in-flight crop request itself is not currently a durable queue job.

## Targeted prompt

The targeted prompt instructs the model to transcribe only the crop and to preserve the project's uncertainty protocol.

It does not ask the model to rewrite the full page.

## Region result provenance

Each targeted result records, where available:

- Primary/Secondary pass
- provider
- model
- timestamp
- raw targeted text
- mechanically repaired targeted text
- repair log
- validation warnings
- truncation/stop reason
- usage metadata
- crop hash
- hash of the page final text at request time

Each region also keeps an event history for:

- created
- completed
- transient retry
- failed/cancelled
- disagreement
- preferred selection
- applied
- kept-current

## Primary / Secondary comparison

The latest Primary and Secondary results for a region are compared conservatively after whitespace normalization.

If they differ:

- mark **Model disagreement**
- route the page toward Review where appropriate
- do not automatically choose either answer

If the page was already Approved, newly discovered model disagreement requires human reapproval.

## Preferred targeted result

A reviewer may explicitly mark any targeted result as preferred.

Selecting a preferred result never edits final page text automatically.

If the region is linked to final text and the preferred targeted result differs from that linked text:

- region becomes stale
- page becomes **Needs Refresh**

## Resolving Needs Refresh

Two explicit actions are available:

### Apply preferred to final text

- preserve the previous page revision
- replace only the linked text span
- keep the region provenance
- re-run deterministic LaTeX validation/classification
- require reapproval when the page had previously been Approved

### Keep current final text

- retain the existing page text
- record that the human rejected the preferred targeted replacement for the downstream page
- resolve that region dependency without silently rewriting text

## Dependency tracking

Region text links are stored as anchored character ranges plus the selected text.

When page text changes:

- attempt to re-anchor by exact selected-text matching near the old location
- if the anchor cannot be found, mark it detached
- a detached preferred dependency remains Needs Refresh until resolved/recreated

Whole-page retries remain available as a manual fallback.

A whole-page retry does not delete targeted-region history.

If a whole-page result still disagrees with a preferred targeted dependency, the page remains Needs Refresh.

If it resolves the dependency for a previously Approved page, Needs Reapproval remains required.

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

The remote URL is pinned to MathJax `3.2.2`; it no longer floats on the `@3` major tag.

Important security follow-up:

The older handoff prohibited all remote MathJax loading on the main API-key page. Upgrade 4 introduced on-demand main-page loading for live preview. Pinning reduces supply-chain drift, but before treating this as production-hardened, strongly consider bundling/self-hosting MathJax or otherwise eliminating reliance on third-party remote script execution on a page where API keys may be entered.

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

# Project Save / Open / Archive

Upgrade 10 added explicit portable project and archive workflows.

## Save Project

**Save Project .json** exports the current versioned project envelope:

`math-photo-notes-project-v1`

The saved project includes:

- pages and stable IDs
- original image data when retained
- page order and document groups
- metadata
- raw/repaired/final transcription
- revision history
- review flags
- routing history
- targeted regions/results/provenance
- approval / Needs Reapproval / Needs Refresh state
- durable whole-page queue state
- safe non-secret provider/model/routing settings
- user-entered cost rates

API keys are never included.

## Open Project

**Open Project** validates the project envelope before replacing the current project.

Opening a project:

- requires active processing to be stopped first
- restores images, text lineage, organization, targeted regions, and durable queue state
- restores the saved queue as paused/resumable
- resets ephemeral Guided Review / crop-picker state
- does not import API keys

## Project Archive ZIP

**Archive Project .zip** builds a portable ZIP entirely in the browser without a third-party ZIP library.

The archive includes:

- `project.json`
- `audit-manifest.json`
- `usage-report.json`
- combined Markdown
- combined plain text
- combined LaTeX
- original images
- per-page JSON metadata
- raw text
- repaired text
- final text
- revision history
- review flags
- routing history
- usage log
- region crop images
- region JSON/provenance
- targeted result JSON and text

The current ZIP writer uses the standard ZIP container with stored/uncompressed entries.

For very large projects, this may consume substantial browser memory because the archive is assembled in memory before download.

## Review Packages

Each page can export a **Review package ZIP** containing the original image, transcription lineage, review flags, routing/provenance, targeted-region evidence, and review instructions.

Each targeted region can export a **Region package ZIP** containing the crop, page context, candidate targeted results, provenance, and instructions emphasizing that model disagreement has no automatic winner.

## Text Export Expansion

Upgrade 10 adds:

- combined Markdown
- combined plain text
- combined LaTeX
- existing MathJax/PDF exports remain available

The LaTeX exporter preserves recognized math spans and escapes prose conservatively.

---

# Usage / Cost Reporting

Provider usage metadata is normalized where available.

Recognized token fields include common OpenAI-compatible, Anthropic, and Gemini naming patterns.

The project records whole-page usage events going forward and also includes targeted-region result usage.

Cached whole-page replays are recorded but contribute zero estimated API cost.

Users may enter separate per-million-token input/output rates for:

- Primary AI
- Secondary AI

The app displays a live project usage summary and can export:

`photo-to-text-usage-report.json`

Cost values are estimates only.

They are not provider invoices because:

- provider usage metadata may be absent or incomplete
- image pricing may not map cleanly to input/output token rates
- cached/provider-specific pricing rules may differ
- user-entered rates may be stale

Do not hard-code provider prices into the application.

---

# Provenance / Audit Manifest

Upgrade 10 adds a standalone audit manifest and includes it in project archives.

The manifest summarizes:

- page IDs/names/order
- document membership
- classification/status
- image hash
- processing fingerprint
- latest provider/model/pass
- approval timestamp
- Needs Reapproval / Needs Refresh
- revision count
- review-flag count
- routing-event count
- targeted-region IDs/hashes/dependencies/results/events

The audit manifest does not contain API keys.

---

# External AI Round Trip

Release C adds a complete external-review loop while keeping this app as the source of truth.

## Export

**Review with External AI** creates chunked review ZIPs.

Default chunk size: 10 pages.

Selectable chunk sizes:

- 5
- 10
- 20

Each package has a stable package ID and expected page-ID list that are persisted in the project.

Each ZIP contains source images where available, page records, current/raw transcription, deterministic warnings, Math Unsure details, metadata, a generated review prompt, a manifest, and an exact return template.

The prompt tells outside AI systems to propose corrected text only. They must not approve pages or assign application states.

## Import

The importer accepts raw JSON as well as common chat output such as Markdown JSON fences and surrounding prose.

It reports:

- matched pages
- unknown page IDs
- duplicates
- malformed entries
- expected pages missing from the response

External classification or approval fields are ignored.

Importing creates pending proposals only.

It does **not** change final text or page state.

## Human decision

Each proposal displays:

- source image
- current final text
- proposed external text
- visible diff
- external note

Proposed text starts read-only.

The human may:

- Accept
- Reject
- Edit proposal

Accepted changed text preserves the previous final revision, records external provenance, re-runs safe repair/classification, and revalidates targeted-region dependencies.

A material accepted change to an Approved page becomes Needs Reapproval.

Reject preserves the existing final text and records the rejection.

Pending import sessions persist through Save/Open and can be resumed.

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
- automatic routing enabled/disabled state, max attempts, and cache policy
- targeted region count
- Needs Refresh page count
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
18. automatic routing bypassing the durable queue.
19. repeated Review/Math Unsure routes creating infinite AI loops.
20. automatic routing touching Approved or Needs Reapproval pages.
21. missing Secondary credentials turning an automatic route into a Failed transcription instead of pausing the queue.
22. disabling automatic routing leaving pending auto-route jobs silently active.
23. targeted crop AI silently replacing full-page transcription.
24. Primary/Secondary targeted disagreement auto-selecting a winner.
25. preferred region results changing page text before explicit human apply.
26. deleting/reanchoring a region silently losing a stale dependency.
27. Approved pages resolving targeted dependencies without preserving reapproval requirements.
28. automatic whole-page routing operating on Needs Refresh pages.
29. project/archive exports including API keys.
30. project import replacing active work while requests are running.
31. cached result replays being counted as new estimated API spend.
32. page/region review packages omitting provenance needed to reproduce review decisions.
33. archive export silently dropping original images or targeted crop evidence when those bytes are available.
34. cost estimates being presented as provider billing truth.
35. an over-escaped dynamic LaTeX-repair RegExp crashing on ordinary math spans.
36. a repair/validator exception being mislabeled as an API/browser failure.
37. successful provider raw text being assigned only after post-processing succeeds.
38. a local post-processing bug triggering automatic Secondary spend.
39. Gemini API keys appearing in request URLs.
40. built-in self-tests existing in source but never being executed by CI.
41. MathJax returning to a floating CDN major-version URL.
42. Quick Transcribe silently making a semantic second AI pass when Auto-fix is off.
43. batch completion counts being computed from the whole project instead of the run that just finished.
44. Retry Failed blindly repeating a known same-slot authentication/configuration failure.
45. Guided Review opened from a batch summary including unrelated pages from older runs.
46. Good-page spot-checks silently re-sampling already checked pages by default.
47. a human-found Good-page error leaving the page classified Good.
48. an OK spot-check being treated as approval.
49. spot-check evidence losing model/prompt/processing provenance across Save/Open.
50. reliability reporting turning small human samples into an unsupported accuracy percentage.
51. external-AI import changing final text before explicit human acceptance.
52. outside-AI classification/approval fields controlling application state.
53. unknown, duplicate, malformed, or missing external-return entries being silently ignored without a report.
54. accepting an external correction destroying the previous final transcription.
55. accepted external changes on Approved pages remaining Approved.
56. rejecting an external proposal changing page text.
57. external-review package IDs/expected page IDs being lost across project Save/Open.
58. pending imported proposals disappearing when the review panel is closed.
59. accepting an unchanged external proposal unnecessarily forcing Needs Reapproval.
60. JSON external-review returns silently turning LaTeX commands into control characters (for example \frac → form feed, \theta → tab, \neq → newline).
61. invalid single-backslash LaTeX JSON failing with a vague generic parse error instead of a math-specific safety message.
62. Clear all deleting long-term Good-page reliability evidence.
63. opening a project replacing rather than merging the browser-global reliability ledger.
64. external-review workflow being ZIP-only when a chat client needs loose source images to force visual inspection.
65. High Assurance redundantly verifying pages that were already Review / Math Unsure / Unclear instead of limiting verification to otherwise-Good pages.
66. the High Assurance verifier receiving the Primary transcription or hidden reasoning and therefore losing independence.
67. High Assurance disagreement overwriting the Primary transcription or automatically choosing the Secondary answer.
68. Auto-fix continuing automatically after a High Assurance disagreement instead of stopping for human Review.
69. High Assurance verifier calls being omitted from usage/cost reporting.
70. reliability evidence labeling a page High Assurance merely because the batch toggle was on even though that page was not actually verified.
71. formatting-only math delimiter changes causing false High Assurance disagreement.
72. a verifier result queued against an older Primary text changing state after the Primary text has since changed.
73. a High Assurance process batch starting without usable Secondary configuration/credentials.
74. targeted-region work disappearing or duplicating after reload because it bypasses durable queue persistence.
75. new project fields being added without an explicit schema migration.
76. MathJax live preview appearing local while PDF export still executes a remote CDN script.
77. vendored MathJax component trees omitting `core.js` or another required dependency and silently failing to render.
78. the one-file offline builder using an unpinned/floating MathJax bundle.
79. the offline build rendering preview math but requiring companion MathJax files for PDF export.
80. archive generation regressing to one giant uncompressed in-memory concatenation for large projects.
81. image-quality assistance mutating the original evidence image instead of remaining non-destructive/display-only.

---

# Current Product Plan

The original numbered Upgrade 1–10 roadmap is complete.

Active product work now follows the second-generation roadmap in `UPGRADE_PLAN.md`.

## Product direction

Use one underlying processing engine with a simplified user-facing workflow:

- **Quick Transcribe** — one Primary semantic pass, classify, stop
- **Auto-fix flagged pages** — optional bounded rerouting of problem piles
- **High Assurance Math** — optional higher-cost independent verification
- **Guided Review** — post-processing review action, not a separate processing mode

The default user story is:

> Turn these photos into text, tell me what looks questionable, and let me deal with those pages now or later.

## Active releases

### Release A — Simplified Batch UX — implemented 2026-09-30
- Quick Transcribe is the default batch path
- Auto-fix flagged pages is the user-facing name for bounded automatic routing
- High Assurance Math is an optional verification workflow; it remains off by default
- power-user routing/retry controls are collapsed under Advanced
- completed queues produce a persisted run-scoped dashboard
- dashboard explains the limited meaning of Good
- dashboard actions: Review flagged pages, Resume Interrupted, Retry Failed, Export everything
- flagged review is scoped to Review / Unclear / Math Unsure / Needs Reapproval / Needs Refresh pages from that run
- interrupted recovery preserves prior pass selection where practical
- failed retry blocks known same-slot auth/configuration repeats
- browser CI covers one-pass Quick Transcribe behavior

### Release B — Good-page spot checks — implemented 2026-09-30
- random Good-page sample from the completed batch
- selectable sample size: 1 / 5 / 10 / 20
- previously checked Good pages excluded by default
- persisted sample page IDs / active session
- source image + final transcription review UI
- Looks OK / Record error / Skip
- structured optional error categories and notes
- Error found moves Good → Review without rewriting transcription
- OK never approves
- persistent project-level reliability ledger
- final-text hash + image hash + provider/model/pass + prompt/processing fingerprints
- Auto-fix / High Assurance provenance
- grouped human evidence counts by provider/model/prompt
- direct JSON evidence export
- archive/audit inclusion
- browser CI covers ledger persistence and Error-found behavior
- no formal accuracy percentage

### Release C — External AI round trip — implemented 2026-09-30
- Review with External AI from batch summary or Project / Export
- flagged/problem-page selection; transport-only Interrupted pages excluded by default
- 5 / 10 / 20-page chunk ZIPs, default 10
- stable persisted package IDs + expected page IDs
- source image, current/raw transcription, warnings, metadata, prompt, manifest, and return template
- generated prompt prohibits external approval/classification and invented IDs
- external AI returns proposed text only
- tolerant raw/fenced/prose-wrapped JSON parser
- matched / unknown / duplicate / malformed / expected-missing report
- imported proposals cannot change text or state before human decision
- source/current/proposed three-way review with visible diff
- Accept / Reject / Edit proposal
- pending sessions persist and can be resumed
- accepted changed text preserves prior revision and external provenance
- deterministic repair/classification re-runs after acceptance
- targeted dependencies are re-anchored/revalidated
- Approved changed text → Needs Reapproval
- no-op accepted proposal does not invalidate approval
- rejected proposals preserve text and record rejection provenance
- external AI never controls application classification or approval
- browser CI covers package contract, tolerant import, diff, accept, reject, and approval lineage

### Release C hardening after adversarial review — implemented 2026-09-30
- preferred outside-AI return format changed from JSON to literal delimited PAGE blocks
- `return-template.txt` is primary; JSON is fallback only
- literal LaTeX backslashes are preserved in the block parser
- unsafe single-backslash LaTeX commands in JSON are rejected before JSON.parse can silently reinterpret them
- CI regression covers `\\frac`, `\\beta`, `\\theta`, `\\neq`, and `\\sqrt`
- IndexedDB upgraded to version 2 with separate `reliability` store
- global spot-check ledger survives Clear all and reload
- project ledger snapshots merge into global evidence instead of replacing it
- external review export supports ZIP or Loose images + text
- Loose mode is intended for direct multi-file chat upload testing; ZIP remains the reproducible archive format

### Release D — High Assurance Math — implemented 2026-09-30
- off by default
- policies: Math-heavy only / Any detected math / All Good pages
- verification is limited to pages that would otherwise be Good
- deterministic math trigger score/signals are saved as provenance
- verifier is a fresh Secondary-slot call through the durable queue
- verifier sees the original image and project rules, not the Primary transcription or hidden reasoning
- Secondary configuration is required before a High Assurance batch starts
- verifier uses existing pause/resume/cancel/timeout/transient-retry infrastructure
- Primary final text is never replaced automatically
- math payloads and prose skeletons are compared separately, with whole-text similarity as a secondary signal
- formatting-only delimiter differences are tolerated
- semantic math disagreement → Review
- verifier warnings/truncation/non-Good results → Review
- disagreement never selects a winner
- High Assurance disagreement does not continue into Auto-fix
- stale Primary-text hash guard prevents an older verifier result from changing newer page state
- verifier failures preserve Primary and require Review; cancellation preserves Primary
- page card exposes independent verifier evidence
- batch summary reports verified / disagreement / failed verification counts
- verifier calls are explicit in usage/cost reporting
- cost preview shows maximum extra-call count and historical cost estimate when rate/history data exist
- audit/archive/Doctor preserve High Assurance evidence
- spot-check records distinguish requested from actually verified
- reliability groups separate standard Good pages from High Assurance verified pages
- Chromium CI covers agreement and sign-level disagreement end to end

### Release E — Infrastructure hardening — implemented 2026-09-30
- durable targeted-region queue jobs with resumable persisted region work
- explicit project v1 → v2 migrations and migration history
- checked-in deterministic browser regression fixture corpus
- regular browser MathJax is fully self-hosted from `vendor/mathjax`; the original CHTML/startup layout was later superseded by the single pinned `tex-svg-full.js` bundle
- rendered-browser gate now verifies the pinned SVG bundle, renderer corpus, popup/PDF parity, and zero remote executable MathJax
- PDF/print MathJax uses the same pinned SVG policy
- EquationWright-inspired one-file offline packaging, now using pinned MathJax 3.2.2 `tex-svg-full.js`
- fetch helper verifies exact Git blob SHA-1 before building
- offline PDF path reuses the embedded tex-svg-full bundle
- CI runs the complete browser suite against both normal and generated offline HTML
- compressed/memory-aware large archive writer
- evidence-driven non-destructive image review assist
- Releases A–E are complete; future work is maintenance / evidence-driven refinement, not an undefined Release F

# MathJax / Offline Build

Math Photo to Notes now has one MathJax policy with two delivery forms.

## Normal repository/browser mode

`photo_to_text.html` loads exactly one local renderer asset:

`vendor/mathjax/tex-svg-full.js`

The bundle is MathJax 3.2.2 with pinned Git blob SHA-1:

`b3388d20a8d2773b001eebd3211ef1a337335d67`

There is no active `startup.js`, component-tree, CHTML, or webfont dependency. `vendor/mathjax/` intentionally contains only the MathJax license and the pinned `tex-svg-full.js` bundle.

## Single-file offline edition

1. `python3 scripts/fetch_mathjax.py`
2. `python3 make_offline_build.py`

The builder verifies and embeds that exact same pinned `tex-svg-full.js` source in `photo_to_text_OFFLINE.html` using:

`id="embedded-mathjax-source"`

The normal app loads the vendored file; the offline build embeds it. They are two builds of one source application, not two independently maintained programs.

## Trust boundary and renderer policy

TeX can originate from vision-AI output and imported external corrections, so it is untrusted input.

All live-preview / offline / PDF configurations:

- use SVG output
- disable MathJax `html`
- disable `noundefined`
- disable `require`
- detect rendered `merror` nodes
- preserve source/final text on render error
- allow only the authoritative final preview to persist render warnings or move Good → Math Unsure

## Browser release gate

The checked-in renderer fixture corpus covers representative ordinary math, structures, extension-heavy notation, malformed/undefined TeX, and unsafe link/style/require attempts.

CI runs the same corpus against:

- normal `photo_to_text.html`
- generated `photo_to_text_OFFLINE.html`

The browser gate also:

- verifies the exact vendored MathJax Git blob SHA
- captures MathJax requests from the main page and popups
- opens the actual PDF/print popup and waits for SVG output
- verifies live and PDF package policy remains aligned
- allows the normal edition to request only local `tex-svg-full.js`
- requires the offline edition to make zero companion MathJax requests
- rejects remote executable MathJax

Do not weaken the hash verification, reintroduce a floating MathJax URL, or add a second renderer path without updating these parity gates.

---

# High Assurance Math

Release D adds independent verification for selected pages that would otherwise be Good.

## Eligibility

High Assurance runs only for normal **Process Batch** Primary results that finish as Good.

Policies:

- **Math-heavy only** — default; deterministic math-heavy score threshold
- **Any detected math**
- **All Good pages**

Flagged pages are not redundantly verified; they retain the existing Review / Auto-fix workflow.

## Independence boundary

The verifier uses the Secondary configuration and original image.

Its prompt explicitly asks for an independent transcription and does not include the Primary transcription.

Do not change this into a “critique this Primary answer” prompt without reconsidering the independence assumption.

## Comparison

The app compares:

- normalized math payloads
- prose skeletons with math replaced by placeholders
- normalized whole-text similarity

This intentionally tolerates delimiter/whitespace-only differences while treating changed mathematical content conservatively.

If comparison or verifier quality checks raise concern:

- keep the Primary final text
- preserve the Secondary verifier reading
- move the page to Review
- choose no automatic winner
- do not feed that assurance disagreement into automatic routing

## Stale-result protection

A High Assurance queue job stores a hash of the Primary text it was created to verify.

If final text changes before comparison, the verifier result becomes stale evidence only and cannot mutate page state.

## Reliability meaning

A batch can request High Assurance without every Good page being eligible.

Therefore:

- `lastHighAssurance` means High Assurance was requested for the batch
- `highAssuranceStatus === 'verified'` means this specific page actually received and passed independent verification
- spot-check/reliability reporting must use actual verified status, not merely the batch toggle

---

## Important interpretation of Good

`Good` means:

**No automatic warning signals were detected.**

It does not mean:

- independently verified
- human reviewed
- guaranteed correct

Batch summaries should say this explicitly.

## Spot-check evidence

Store each human Good-page spot-check with:

- page ID
- timestamp
- provider/model/pass
- prompt fingerprint
- processing fingerprint
- batch/run context
- Auto-fix / High Assurance settings
- OK or Error found
- optional error type/note

Show earned counts such as:

> Across 40 spot-checked Good pages from this model/prompt, 37 were marked OK and 3 had errors.

Do not automatically convert that into a formal accuracy claim.

## External AI authority boundary

External AI is an untrusted proposal source.

It may return:

- page ID
- proposed corrected text
- optional note

It must not control:

- pile/classification
- approval
- Needs Reapproval
- Needs Refresh

Imported proposals require human diff review before final text changes.

See `UPGRADE_PLAN.md` for the full release plan and acceptance criteria.

---


# MathJax Renderer Unification — Maintenance Plan

This maintenance plan is complete.

## Architecture decision: one source, two builds

The application has one source program, `photo_to_text.html`.

- normal edition: loads pinned local `vendor/mathjax/tex-svg-full.js`
- offline edition: generated from the same source and embeds that exact pinned bundle

Application behavior stays shared; the offline builder changes packaging only.

## Completed steps

1. **SVG parity** — normal preview, offline preview, and PDF/print all use SVG.
2. **Broader handwritten-math bundle** — all paths use pinned MathJax 3.2.2 `tex-svg-full.js`.
3. **Render-error evidence / untrusted TeX** — `merror` nodes are surfaced, source text is preserved, and `html`, `noundefined`, and `require` are disabled.
4. **Renderer corpus** — checked-in fixtures cover ordinary math, matrices/cases/alignment, extension-heavy notation, malformed/undefined TeX, and unsafe TeX attempts in both editions.
5. **Renderer-drift gate** — exact bundle identity, live-preview policy, actual PDF/print SVG rendering, request behavior, and offline embedding are regression-tested.
6. **Cleanup** — obsolete CHTML/startup/component assets and the old `tex-svg.js` bundle are removed.

The MathJax maintenance work should now be treated as regression-protected infrastructure rather than an open migration.

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
9. run the browser smoke suite for any change touching transcription, math repair/validation, provider adapters, routing, persistence, or export
10. treat JavaScript parse success as only a preliminary check; the normal math happy path must execute in a browser
