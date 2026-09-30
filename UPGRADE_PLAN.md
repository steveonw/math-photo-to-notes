# Photo-to-Text Upgrade Specification

## 1. Goal

Upgrade the current browser-based photo-to-text tool into a reliable bulk note-processing system for handwritten and printed notes, with special support for mathematical notation.

The system should prioritize:

- transcription accuracy
- preservation of mathematical notation
- visible uncertainty instead of silent guessing
- low-cost first-pass processing
- selective use of stronger AI models
- easy human review
- safe LaTeX repair
- batch organization
- export to Markdown, LaTeX, and PDF
- preservation of earlier AI results so nothing useful is lost

---

# PART 1 — Core Reliability

## 1.1 Processing states

Every image should belong to one of these states:

### Queued
Not processed yet.

### Running
Currently being processed.

### Good
No automatic warning signals were found.

### Review
The transcription completed but has suspicious characteristics.

Examples:

- unusually short output
- garbled characters
- incomplete-looking output
- formatting anomalies
- possible model truncation

### Unclear
The AI explicitly reports unreadable non-mathematical text.

Example:

`[unclear]`

### Math Unsure
The AI is uncertain about mathematical notation.

Example:

`[MATH_UNSURE: seen="x ? 4" guess="$x+4$" note="operator could be + or -"] (I think it says: $x+4$)`

### Failed
The API request or processing operation failed.

### Approved
A human reviewed the transcription and marked it finished.

Approved pages should not be automatically processed again unless manually unlocked.

---

## 1.2 Preserve transcription history

Each image should maintain three versions:

### Raw AI transcription
Exact text returned by the AI.

### Repaired transcription
Result after safe LaTeX cleanup.

### Final transcription
Human-edited version.

Every retry should create a new revision rather than deleting the previous version.

Required controls:

- Restore previous
- View raw
- View repaired
- View final
- Compare versions

---

## 1.3 Detect incomplete API responses

Detect when an AI response may have stopped because of an output-token limit.

If truncation is detected:

- classify the page as Review
- display `Possible truncated response`
- preserve the partial transcription
- allow retry with Primary or Secondary AI

If provider metadata includes a stop reason, use it.

Examples:

- `max_tokens`
- `length`
- incomplete response state

---

# PART 2 — Primary and Secondary AI System

## 2.1 Independent AI configurations

The system should maintain two completely independent configurations.

### Primary AI

Fields:

- Provider
- Model
- API key
- Base URL if required
- Prompt
- image-detail option if supported

Typical use:

Fast and inexpensive first pass.

### Secondary AI

Same fields as Primary.

Typical use:

More capable model for difficult pages.

---

## 2.2 Per-pile AI routing

Each pile should independently select:

- Primary
- Secondary

Required selectors:

- Review
- Unclear
- Math Unsure
- Failed
- Current pile

Selections should persist locally.

---

## 2.3 Optional automatic routing

Add an optional setting:

`Automatically process problem piles with selected AI`

When enabled:

Primary AI processes the original image.

Then:

`Good → stop`

`Review → selected Review AI`

`Unclear → selected Unclear AI`

`Math Unsure → selected Math Unsure AI`

`Failed → selected Failed AI`

Automatic routing must have:

- maximum retry count
- no infinite retry loops
- visible retry history
- ability to disable automation

Recommended default:

Maximum 2 AI attempts per image.

---

# PART 3 — Confidence and Quality Scoring

## 3.1 Internal quality score

Generate a quality score using observable warning signals rather than asking the model to invent a confidence percentage.

Possible factors:

- number of `[unclear]` markers
- number of `MATH_UNSURE` markers
- malformed LaTeX
- response length
- truncation status
- unusual replacement characters
- repeated punctuation
- incomplete delimiter pairs
- excessive repair operations
- mismatch between first and second AI passes

Example score:

`Quality: 87/100`

This score is a review aid, not a claim that the transcription is 87% objectively correct.

---

## 3.2 Automatic thresholds

Suggested defaults:

### 90–100
Good

### 70–89
Review

### Below 70
Review or Unclear depending on detected problems

Explicit `[unclear]` overrides the score and goes to Unclear.

Explicit `MATH_UNSURE` overrides the score and goes to Math Unsure.

---

# PART 4 — Mathematics Handling

## 4.1 Math transcription protocol

AI should preserve math using LaTeX.

Preferred forms:

Inline:

`$x^2+3x$`

Display:

`$$\int_0^1 x^2\,dx$$`

or:

`\[...\]`

The prompt should explicitly request preservation of:

- fractions
- radicals
- exponents
- subscripts
- Greek letters
- derivatives
- partial derivatives
- integrals
- summations
- limits
- matrices
- vectors
- piecewise functions
- equation alignment
- integral bounds

---

## 4.2 Math uncertainty protocol

Never silently guess uncertain mathematics.

Required marker:

`[MATH_UNSURE: seen="..." guess="..." note="..."]`

Human-readable guess:

`(I think it says: ...)`

---

## 4.3 Safe LaTeX repair

Only perform repairs that do not require guessing mathematical meaning.

Safe examples:

- Unicode `−` → `-`
- `×` → `\times`
- `π` → `\pi`
- `∞` → `\infty`
- `≤` → `\le`
- `≥` → `\ge`
- doubled MathJax delimiters
- obvious missing command backslashes inside known math regions

Unsafe example:

Do not automatically transform `√x` into an expression whose radical scope is uncertain.

Instead:

- preserve it
- mark it for Math Unsure if necessary

---

## 4.4 EquationWright validation layer

Reuse EquationWright-style checks where applicable.

Check for:

- unmatched `{ }`
- unmatched `\(` and `\)`
- unmatched `\[` and `\]`
- unmatched `$$`
- incomplete `\frac`
- malformed `\sqrt`
- incomplete superscripts
- incomplete subscripts
- broken matrix environments
- mismatched `\begin{}` / `\end{}`
- suspicious missing backslashes
- malformed integral limits

Repairs and warnings must be separate.

### Repair
Safe automatic transformation.

### Warning
Potential mathematical problem requiring human or AI review.

---

# PART 5 — Math Preview and Editing

## 5.1 Live MathJax preview

Each transcription card should provide:

### Source
Editable text / LaTeX.

### Preview
Rendered MathJax result.

The preview should update after editing.

## 5.2 Highlight errors

If MathJax cannot render an expression:

- show the problematic source
- highlight the approximate location
- classify as Math Unsure
- do not delete the original source

---

# PART 6 — Better Human Review

## 6.1 Side-by-side review mode

Desktop layout:

`Original image | transcription`

Controls:

- zoom image
- rotate
- fit width
- fit page
- previous page
- next page

## 6.2 Review shortcuts

Keyboard shortcuts could include:

- `A` → Approve
- `R` → Review
- `U` → Unclear
- `M` → Math Unsure
- `1` → rerun with Primary
- `2` → rerun with Secondary
- arrow keys → next/previous page

## 6.3 Approved state

Add `Mark Approved`.

Approved means:

- human checked
- excluded from automatic retries
- ready for final export

Allow `Unapprove`.

---

# PART 7 — Image Preparation

## 7.1 Rotation

Controls:

- rotate 90° left
- rotate 90° right
- rotate 180°

Optional:

automatic orientation detection.

## 7.2 Image enhancement

Non-destructive options:

- grayscale
- contrast
- brightness
- shadow reduction
- sharpen
- crop
- straighten

Always retain the original file.

## 7.3 Duplicate detection

Before processing, identify likely duplicate images.

Possible techniques:

- file hash
- dimensions
- perceptual image hash

---

# PART 8 — Page and Document Organization

## 8.1 Drag-and-drop ordering

Users should be able to reorder pages before and after processing.

## 8.2 Document groups

Allow images to be grouped into notebooks/documents.

## 8.3 Metadata

Optional metadata:

- title
- class
- chapter
- lecture
- date
- page number
- tags

## 8.4 Page-number recognition

Attempt to detect printed or handwritten page numbers.

Do not automatically reorder unless the user enables it.

---

# PART 9 — Second-Pass Intelligence

## 9.1 Whole-page retry

Current behavior remains available.

Send the entire original image to either AI.

## 9.2 Equation-only retry

Later upgrade.

For a Math Unsure marker:

- identify approximate equation region
- crop that region
- send only the crop to Secondary AI
- ask only about the uncertain mathematical portion

## 9.3 AI comparison mode

Optional high-accuracy mode.

Process the same page with:

- Primary
- Secondary

Compare results.

If substantially different:

`Model disagreement`

Move to Review.

Do not automatically decide which answer is correct.

---

# PART 10 — Batch Management

## 10.1 Progress reporting

Display:

- total pages
- queued
- running
- good
- review
- unclear
- math unsure
- failed
- approved

## 10.2 Concurrency control

Setting:

`Simultaneous requests`

Suggested default: 2.

## 10.3 Rate-limit handling

Detect:

- HTTP 429
- temporary provider failures
- timeout

Automatically:

- pause
- retry with exponential backoff
- preserve queue position

Never classify a temporary rate limit as a bad transcription.

## 10.4 Retry limits

Track:

- Primary attempts
- Secondary attempts
- failures
- last error

---

# PART 11 — Cost Tracking

## 11.1 Usage summary

Where provider metadata permits, record:

- input tokens
- output tokens
- image usage
- model
- provider

## 11.2 Estimated cost

Allow the user to enter/update model rates.

Do not hard-code pricing permanently because provider prices change.

---

# PART 12 — Persistence and Recovery

## 12.1 Save project

Add `Save Project`.

Export a project manifest containing:

- file names
- image ordering
- classifications
- transcription versions
- repair history
- retry history
- AI model information
- document groups
- metadata
- settings

API keys must never be included.

## 12.2 Restore project

Add `Open Project`.

## 12.3 Autosave

Autosave project state locally after:

- transcription
- manual edit
- classification change
- page reorder
- approval

---

# PART 13 — Export System

## 13.1 Markdown

Options:

- one combined file
- one file per page
- one file per document

## 13.2 LaTeX

Export `.tex`.

## 13.3 PDF

Render with MathJax.

Export options:

- Approved only
- Good + Approved
- specific pile
- selected document
- all pages

## 13.4 Plain text

For systems that do not support Markdown or LaTeX.

## 13.5 Archive export

Later option:

Create a ZIP containing:

- original images
- raw AI text
- repaired text
- final text
- PDF
- Markdown
- project manifest
- error report

---

# PART 14 — Suggested Development Phases

## Phase A — Reliability Foundation

1. Approved state
2. raw/repaired/final versions
3. revision history
4. truncation detection
5. retry attempt counters
6. safer LaTeX validator
7. autosave state

Phase A establishes the rule that useful earlier results are never destroyed.

## Phase A2 — Reliability Hardening

This phase moves reliability infrastructure ahead of automatic routing and large-batch features.

### A2.1 Versioned project schema

Use an explicit project format such as:

`math-photo-notes-project-v1`

Persist:

- stable page IDs
- image hash
- file metadata
- ordering
- current processing state
- raw/repaired/final transcription
- revision history
- repair history
- validation warnings
- retry/attempt history
- provider/model provenance
- approval state
- cache metadata

API keys must never be stored in the project.

Future schema changes must migrate old project data rather than silently discarding it.

### A2.2 IndexedDB project storage

Use IndexedDB for durable project/page/image storage.

Use `localStorage` only for small preferences and a lightweight compatibility/recovery path.

Large image batches must not depend on `localStorage` quota.

### A2.3 Corrupt-state recovery

Project loading must:

- validate the project envelope/version
- back up malformed data before resetting
- explain recovery failures clearly
- avoid replacing corrupt data with an empty project without preserving the original
- migrate known older schema versions when possible

### A2.4 Provider capability registry

Track capabilities per provider/configuration, including:

- vision/image input
- known truncation/finish metadata
- usage metadata availability
- compatible image formats
- request cancellation support
- base URL requirements
- browser/CORS caveats

Do not assume every OpenAI-compatible endpoint implements the same behavior.

### A2.5 Diagnostics / Doctor

Add a diagnostics report that checks:

- IndexedDB availability
- storage quota when the browser exposes it
- autosave health
- image-format support
- selected provider configuration
- model name presence
- API-key presence without storing or displaying the key
- compatible base URL configuration
- request timeout/cancellation support
- cached result count
- interrupted/running jobs needing recovery

Diagnostics should recommend a next action rather than just dumping errors.

### A2.6 Request identity, cancellation, and stale-result protection

Every AI attempt gets a unique attempt ID.

Requirements:

- `AbortController` where supported
- explicit request timeout
- Cancel Current / Cancel Batch
- a late response from an older attempt must never overwrite a newer attempt
- duplicate clicks must not create duplicate in-flight work
- interrupted requests return to a resumable state rather than silently becoming bad transcriptions

### A2.7 Durable job state

Track page jobs independently from the UI loop.

Suggested states:

- Queued
- Running
- Interrupted
- Done
- Failed
- Approved

On reload, a previously Running item should become Interrupted/Queued for safe resume.

### A2.8 Image and processing fingerprints

Compute a cryptographic image hash where Web Crypto is available.

Build a processing fingerprint from:

- image hash
- provider
- model
- prompt version/content
- relevant image/detail options

Use fingerprints for:

- exact duplicate detection
- preventing accidental duplicate calls
- identifying whether a cached transcription is reusable
- provenance in revision history

### A2.9 Content-addressed cache

Cache successful AI results by processing fingerprint.

A cache entry should preserve:

- raw transcription
- provider/model
- stop reason
- timestamp
- repair/validation results

A retry explicitly requested as a fresh AI pass must be able to bypass the cache.

### A2.10 Regression fixtures and self-tests

Create deterministic tests for:

- safe LaTeX repair
- classification
- truncation parsing
- project-schema migration/validation
- stale-attempt rejection
- processing fingerprints

Maintain a manual/fixture corpus containing:

- fractions
- radicals
- integrals
- matrices
- superscripts/subscripts
- crossed-out handwriting
- blank pages
- rotated pages
- shadows
- long pages
- Unicode math
- malformed LaTeX
- explicit `MATH_UNSURE` markers

The known semantic bug `√x → \\sqrt{}x` must remain a permanent regression test.

## Phase B — AI Routing

**Status:** Implemented through Upgrade 8 on 2026-09-30.

1. Primary/Secondary configuration
2. per-pile AI choice
3. opt-in automatic problem routing
4. bounded total processing attempts
5. per-page routing history
6. provider error handling
7. rate-limit/backoff handling
8. cache bypass/fresh-pass controls
9. repeated-route signature protection
10. durable mixed Primary/Secondary queue jobs
11. credential-aware pause/resume for pending automatic routes
12. Approved / Needs Reapproval protection

Automatic routing is off by default and never performs human approval.

## Phase C — Math Review

1. MathJax live preview
2. EquationWright validation
3. structured Math Unsure markers
4. highlight malformed math
5. math-specific warning categories
6. deterministic checks before optional AI verification

## Phase D — Human Review Interface

1. side-by-side review
2. image zoom
3. rotation
4. keyboard shortcuts
5. approve/unapprove workflow
6. previous/next navigation
7. anchored review flags tied to text ranges and optionally image regions
8. edits after approval automatically produce Needs Reapproval

## Phase E — Batch Scale

1. concurrency control
2. durable queue manager
3. pause/resume
4. duplicate detection using image hashes
5. page ordering
6. retry/backoff system
7. resumable interrupted jobs
8. request deduplication/idempotency

## Phase F — Document Organization

**Status:** Implemented in Upgrade 7 on 2026-09-30.

1. notebook/document groups
2. page metadata
3. page number suggestions
4. drag-and-drop ordering
5. document-scoped Markdown/PDF export groundwork

Implemented behavior:

- groups persist in the project envelope
- pages may remain Unfiled
- page order is stable and persisted
- Guided Review respects the active document filter
- page metadata includes title, class, chapter, lecture, date, page number, and tags
- suggestions are deterministic and must be accepted explicitly
- suggestions never reorder pages automatically

## Phase G — Advanced AI Review

**Status:** Implemented in Upgrade 9 on 2026-09-30.

1. equation/region-only second pass
2. model disagreement detection
3. optional Primary/Secondary region comparison
4. targeted crop reprocessing
5. region-level provenance
6. dependency tracking
7. Needs Refresh state for downstream text affected by targeted re-analysis

Implemented behavior:

- crop selection is visual and uses the original unrotated source image
- a region may be linked to selected final-transcription text
- targeted results never overwrite page text automatically
- reviewer explicitly chooses a preferred result
- differing latest Primary/Secondary region results are flagged as Model disagreement
- the application never selects a winner automatically
- preferred results that differ from linked final text produce Needs Refresh
- Apply preferred replaces only the linked span and preserves page revision history
- Keep current records a human decision without rewriting final text
- detached anchors remain visibly unresolved
- whole-page retry remains available
- targeted result provenance includes provider/model/pass, crop hash, page-text hash, stop/truncation metadata, validation, and event history

Do not recompute an entire page when only one region needs another pass unless the user requests it.

## Phase H — Export and Archival

**Status:** Implemented in Upgrade 10 on 2026-09-30.

1. Markdown export
2. `.tex` export
3. MathJax PDF
4. versioned project export/import
5. ZIP archive
6. usage/cost report
7. portable per-page/per-equation review packages
8. provenance/audit manifest

Implemented behavior:

- explicit Save Project / Open Project using the v1 project envelope
- exported settings exclude API keys
- archive ZIP is generated locally with a dependency-free store-only ZIP writer
- archive contains project JSON, audit/usage manifests, combined exports, originals, page lineage, and targeted-region evidence
- per-page and per-region portable review ZIPs
- plain-text and LaTeX combined exports
- whole-page and region usage normalization
- user-entered Primary/Secondary input/output token rates
- live estimated cost summary
- standalone usage and audit JSON exports

Cost estimation is advisory only and must not be presented as billing truth.

## Phase I — Optional High-Accuracy Workflows

1. independent Math Verifier role over source crop + candidate transcription
2. verifier must not receive hidden reasoning from the first model
3. human remains the final approval authority
4. Fast Batch and Guided Review share the same underlying processing engine

Avoid autonomous multi-agent orchestration where deterministic application logic is sufficient.

---

# Current Implementation Snapshot

As of 2026-09-30, Upgrades 1–10 are implemented or substantially implemented in `photo_to_text.html`.

Current architecture includes:

- raw / repaired / final transcription lineage
- Approved and Needs Reapproval states
- IndexedDB persistence with lightweight localStorage fallback
- v1 project schema
- provider capability diagnostics
- attempt IDs, cancellation, stale-response protection, and timeout handling
- SHA-256 image/process fingerprints
- exact-result cache
- live MathJax preview and structured deterministic math validation
- Guided Review with zoom/fit/rotation and keyboard shortcuts
- persistent anchored review flags
- durable ordered queue
- configurable 1–6 request concurrency
- pause/resume/cancel
- transient 429/5xx/network/timeout retries with Retry-After and exponential backoff
- persistent document/notebook groups and Unfiled pages
- stable page ordering with drag-and-drop
- per-page metadata
- explicit-only page-number suggestions
- document-scoped Guided Review
- document-specific Markdown/PDF export groundwork
- opt-in automatic Review / Unclear / Math Unsure / eligible Failed routing
- durable queue jobs with per-job Primary/Secondary pass
- 2–4 total processing-attempt limits
- repeated classification→AI route loop protection
- visible routing history
- fresh-call vs exact-cache automatic retry policy
- automatic queue pause when routed credentials are unavailable
- visual equation/region crop selection
- targeted Primary and Secondary crop retries
- targeted transient retry/backoff and cancellation
- model-disagreement detection without automatic winner selection
- region-level provenance/event history
- text-span dependency anchors and re-anchoring
- Needs Refresh state and pile
- explicit Apply preferred / Keep current dependency resolution
- approval-lineage preservation after targeted changes
- explicit project JSON Save/Open
- dependency-free portable project ZIP archive
- per-page and per-region review-package ZIPs
- combined Markdown / plain text / LaTeX exports
- normalized usage report and user-configurable rate estimates
- provenance/audit manifest
- export regression tests guarding API-key leakage

A stale duplicated HTML tail discovered during Upgrade 7 was removed so the repository again contains one canonical HTML document.

The numbered Upgrade 1–10 roadmap is complete. Remaining work is tracked as hardening and optional high-accuracy follow-up.

---

# PART 15 — Recommended Build Order

### Upgrade 1 — Phase A
Approved state + revision history + raw/repaired/final text + truncation detection + retry counters + safer validator + baseline autosave.

**Status:** Implemented on 2026-09-30.

### Upgrade 2 — Phase A2
Versioned project schema + IndexedDB + recovery/migrations + provider capability registry + Doctor diagnostics.

**Status:** Core implementation completed on 2026-09-30.

Implemented: v1 project envelope, IndexedDB project/image storage, localStorage fallback, recovery handling, provider capability registry, Doctor diagnostics, image/process hashing groundwork, and cache storage.

Still expected in later hardening: explicit future schema migrations and a larger checked-in regression fixture corpus.

### Upgrade 3 — Phase A2 continuation
Request IDs + timeout/cancellation + stale-response guards + durable job states + image/process fingerprints + exact-result cache + regression self-tests.

**Status:** Core implementation completed on 2026-09-30.

Implemented: attempt IDs, AbortController, stale-result protection, Interrupted state, request timeout, fingerprints, exact-result cache, and initial Doctor self-tests.

### Upgrade 4
Live MathJax preview + stronger EquationWright validation.

**Status:** Implemented on 2026-09-30.

Implemented capabilities include source/preview editing, on-demand MathJax rendering, structured math-warning categories, approximate source snippets, and structured Math Unsure display.

**Security follow-up:** live preview currently loads MathJax on demand in the main application page. Before production hardening, consider bundling/self-hosting MathJax so a third-party remote script is not executed on a page where API keys may be entered.

### Upgrade 5
Side-by-side guided review + anchored flags + Needs Reapproval behavior.

**Status:** Implemented on 2026-09-30.

Implemented capabilities include guided one-page review, previous/next navigation, image zoom/fit/rotation, keyboard review shortcuts, persistent text-anchored review flags with re-anchoring after edits, and automatic Approved → Needs Reapproval transitions when final transcription text changes.

### Upgrade 6
Durable queue manager + concurrency + pause/resume + retry/backoff.

**Status:** Implemented on 2026-09-30.

Implemented capabilities include a persisted ordered queue, 1–6 configurable simultaneous requests with a default of 2, pause/resume without cancelling in-flight work, safe queue recovery after reload, cancellation that preserves resumable interrupted pages, transient HTTP/network/timeout detection, Retry-After support, capped exponential backoff, separate transient retry history, and automatic continuation of the remaining queue after temporary failures. Persistent temporary failures move to Interrupted rather than being treated as a bad transcription.

### Upgrade 7
Document organization + page ordering.

**Status:** Implemented on 2026-09-30.

Implemented capabilities:

- persistent notebook/document groups plus Unfiled
- stable page ordering before and after processing
- drag-and-drop reorder controls
- page metadata: title, class, chapter, lecture, date, page number, tags
- deterministic non-destructive page-number suggestions
- per-page accept/dismiss suggestion controls
- explicit bulk application of suggestions within the current document
- group-aware Guided Review navigation
- ordering/group data in autosave/project state
- document-specific Markdown and PDF export groundwork

Page-number suggestions never reorder pages automatically.

### Upgrade 8
Automatic Primary/Secondary routing using the hardened processing engine.

**Status:** Implemented on 2026-09-30.

Implemented capabilities:

- automatic routing is opt-in and off by default
- Review / Unclear / Math Unsure use their existing independent Primary/Secondary selector
- selected non-transient Failed cases may route through the Failed selector
- each automatic route is appended as a durable queue job rather than recursively invoking AI
- queue jobs carry their own Primary/Secondary pass
- maximum total processing attempts per page is configurable from 2–4
- repeated `classification → AI slot` signatures are blocked
- automatic routes retain visible queued/completed/stopped/cancelled history
- Approved and Needs Reapproval are protected
- automatic routing never approves a page
- automatic retry can require a fresh AI call or allow an exact cached result
- missing credentials/configuration for a pending routed job pause the queue rather than causing transcription failure
- turning automation off cancels pending automatic route jobs but does not abort an already-running request
- restored durable queues retain mixed Primary/Secondary route jobs

### Upgrade 9
Equation/region-only retries + model disagreement checking + dependency/Needs Refresh tracking.

**Status:** Implemented on 2026-09-30.

Implemented capabilities:

- visual targeted crop picker on the unrotated original image
- crop coordinates and crop hash persisted per region
- optional dependency link to selected final-transcription text
- Primary targeted retry
- Secondary targeted retry
- concurrent Primary + Secondary targeted comparison
- targeted requests reuse timeout, cancellation, transient retry, Retry-After, and exponential backoff logic
- latest Primary/Secondary targeted results are compared conservatively
- differing results create Model disagreement and never auto-select a winner
- each result stores provider/model/pass, raw/repaired text, repair/validation information, stop/truncation data, usage metadata, crop hash, and source page-text hash
- per-region provenance/event history
- explicit preferred-result selection
- preferred result never changes page text automatically
- linked mismatch creates Needs Refresh
- explicit Apply preferred updates only the linked final-text span and preserves revision history
- explicit Keep current resolves the dependency without rewriting the page
- text edits and whole-page retries re-anchor/recompute region dependencies
- detached dependencies remain unresolved
- Approved-page lineage is preserved so changed text requires reapproval
- automatic whole-page routing does not consume Needs Refresh pages

Current limitation: targeted in-flight requests are cancellable but are not themselves durable queue jobs across reload; completed region results and provenance are persisted.

### Upgrade 10
Full archive/export system + portable review packages + usage/cost reporting.

**Status:** Implemented on 2026-09-30.

Implemented capabilities:

- explicit versioned Save Project / Open Project
- current `math-photo-notes-project-v1` envelope exported with retained image data
- safe provider/model/routing/project settings without API keys
- active processing must be stopped before project replacement
- restored durable whole-page queues reopen paused
- dependency-free in-browser ZIP archive generation
- archive includes project JSON, original images, raw/repaired/final text, revisions, flags, routing history, targeted crops/results/provenance, audit manifest, usage report, and combined exports
- per-page Review package ZIP
- per-region Review package ZIP
- combined plain-text and LaTeX export in addition to Markdown/PDF
- provider usage-field normalization
- separate user-configurable Primary/Secondary input/output rates
- live estimated usage/cost summary
- standalone usage-report JSON
- standalone audit-manifest JSON
- regression checks that safe settings and audit exports omit API-key fields

Known limitations:

- ZIP entries are stored without compression and archives are assembled in browser memory
- usage/cost estimates depend on provider metadata and user-entered rates
- future project schema versions still need explicit migration functions
- in-flight targeted-region requests are cancellable but not durable across reload

## Roadmap status

Upgrades 1–10 are complete.

Recommended follow-up backlog:

1. durable queue jobs for targeted-region requests
2. future-schema migration framework
3. larger checked-in regression fixture corpus
4. self-host/bundle MathJax
5. optional independent Math Verifier workflow
6. streaming/compressed archive support for very large projects

---

# Design Principles

**Never silently replace uncertainty with confidence.**

**Never destroy a useful earlier result.**

**Never recompute more than necessary.**

When the system knows what it can safely repair, it should repair it.

When it has a plausible interpretation but is uncertain, it should show:

`(I think it says: ...)`

When it cannot determine the content reliably, it should send that page to the appropriate review pile.

Deterministic software should own mechanical checks, state transitions, storage, caching, and routing. AI calls should be used only where language/vision judgment is actually needed.

The final workflow becomes:

`Import → fingerprint → Primary AI/cache → classify → safe repair/validate → targeted secondary AI where appropriate → human review → Approved → export`

with the original image, processing provenance, original AI response, repair history, earlier revisions, and approval lineage always recoverable.
