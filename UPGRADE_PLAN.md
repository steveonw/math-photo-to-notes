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

1. Primary/Secondary configuration
2. per-pile AI choice
3. automatic secondary routing toggle
4. retry limits
5. model history
6. provider error handling
7. rate-limit/backoff handling
8. cache bypass/fresh-pass controls

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

1. notebook/document groups
2. page metadata
3. page number suggestions
4. drag-and-drop ordering
5. group-based exports

## Phase G — Advanced AI Review

1. equation-only second pass
2. model disagreement detection
3. optional dual-model transcription
4. targeted crop reprocessing
5. region-level provenance
6. dependency tracking
7. Needs Refresh state for downstream text affected by a targeted re-analysis

Do not recompute an entire page when only one region needs another pass unless the user requests it.

## Phase H — Export and Archival

1. Markdown export
2. `.tex` export
3. MathJax PDF
4. versioned project export/import
5. ZIP archive
6. usage/cost report
7. portable per-page/per-equation review packages
8. provenance/audit manifest

## Phase I — Optional High-Accuracy Workflows

1. independent Math Verifier role over source crop + candidate transcription
2. verifier must not receive hidden reasoning from the first model
3. human remains the final approval authority
4. Fast Batch and Guided Review share the same underlying processing engine

Avoid autonomous multi-agent orchestration where deterministic application logic is sufficient.

---

# PART 15 — Recommended Build Order

### Upgrade 1 — Phase A
Approved state + revision history + raw/repaired/final text + truncation detection + retry counters + safer validator + baseline autosave.

### Upgrade 2 — Phase A2
Versioned project schema + IndexedDB + recovery/migrations + provider capability registry + Doctor diagnostics.

### Upgrade 3 — Phase A2 continuation
Request IDs + timeout/cancellation + stale-response guards + durable job states + image/process fingerprints + exact-result cache + regression self-tests.

### Upgrade 4
Live MathJax preview + stronger EquationWright validation.

### Upgrade 5
Side-by-side guided review + anchored flags + Needs Reapproval behavior.

### Upgrade 6
Durable queue manager + concurrency + pause/resume + retry/backoff.

### Upgrade 7
Document organization + page ordering.

### Upgrade 8
Automatic Primary/Secondary routing using the hardened processing engine.

### Upgrade 9
Equation/region-only retries + model disagreement checking + dependency/Needs Refresh tracking.

### Upgrade 10
Full archive/export system + portable review packages + usage/cost reporting.

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
