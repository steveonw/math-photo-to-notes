# Math Photo to Notes — Product Roadmap

## 1. Current Status

The original Upgrade 1–10 roadmap is complete.

The project already has the difficult foundation:

- raw / repaired / final transcription lineage
- revision history
- Approved / Needs Reapproval / Needs Refresh
- conservative LaTeX repair and validation
- browser regression CI for the math happy path
- Primary and Secondary AI configurations
- durable whole-page queue with concurrency, pause/resume/cancel, timeout, Retry-After, and transient backoff
- bounded automatic routing with loop prevention
- exact-result caching and processing fingerprints
- Guided Review with image/transcription side-by-side review
- anchored review flags
- document/notebook organization and page ordering
- targeted equation/region retries and Primary/Secondary disagreement review
- project Save/Open
- archive/review-package exports
- usage/cost reporting and audit manifests

The next roadmap is not “Upgrade 11.” It is a product simplification and reliability roadmap built on top of that foundation.

---

# 2. Product Goal

The default experience should be understandable to someone with a large folder of note photos who does not care about the internal routing engine.

The core promise is:

> **Turn these photos into text, tell me what looks questionable, and let me deal with the questionable pages now or later.**

The application should support one underlying processing engine with three levels of assurance, not three separate products.

## Default workflow

`Import → Process → Batch Summary → Review / Spot-check / External AI / Export`

The user should not need to understand queue states, routing signatures, cache fingerprints, or retry machinery unless something goes wrong.

---

# 3. Non-Negotiable Reliability Rules

These rules remain authoritative for every new feature.

1. **Never silently replace uncertainty with confidence.**
2. **Never destroy a useful earlier result.**
3. **Never recompute more than necessary.**
4. **A successful provider response is evidence and must be persisted before local post-processing can fail.**
5. **Good means no warning signals were detected; it does not mean independently verified or correct.**
6. **External AI may propose text but never controls approval or page state.**
7. **No AI disagreement workflow automatically chooses a winner.**
8. **Approved pages must become Needs Reapproval after any accepted text change.**
9. **API keys must never be persisted in projects, archives, review packages, logs, or URLs.**
10. **Changes touching transcription, math repair/validation, providers, routing, persistence, or export must pass browser smoke tests.**

---

# 4. Unified Processing UX

## Phase 1 — One Process Workflow

Replace the conceptual split between “Photo to Text & Go,” “Fast Batch,” and “Guided Review” with one processing workflow.

### Primary action

**Process Batch**

### Default behavior: Quick Transcribe

Quick Transcribe should:

- process each queued page with Primary AI once
- preserve the raw provider response immediately
- run safe repair and deterministic validation
- classify into piles
- stop after the first semantic transcription pass
- continue transient retries for network/rate-limit failures because those are transport recovery, not a second interpretation
- never automatically invoke Secondary AI
- never automatically approve a page

This is the default “photo to text and go” workflow.

### Optional toggle: Auto-fix flagged pages

Rename/reframe the current automatic routing feature as:

**Auto-fix flagged pages**

When enabled:

- Review / Unclear / Math Unsure / eligible Failed pages use their configured Primary/Secondary route
- all existing attempt caps and loop protection remain
- temporary network failures do not count as a new semantic interpretation
- local post-processing failures never trigger another paid AI call
- Approved / Needs Reapproval / Needs Refresh remain protected

This is what the earlier plan called Fast Batch.

### Optional setting: High Assurance Math

Add an explicit higher-cost setting:

**High Assurance Math**

It should be opt-in.

Possible policy:

- identify math-heavy pages using deterministic observable signals
- request an independent second reading only where useful
- compare candidate outputs conservatively
- disagreement moves the page to Review
- never auto-select the preferred answer
- clearly show additional calls/cost before the run

Do not run dual-model verification on every page by default.

### Guided Review

Guided Review is not a processing mode.

It is a post-processing action available from the batch summary, filters, and piles.

---

# 5. Batch Completion Dashboard

## Phase 2 — Make the End of a Batch Actionable

When a queue completes, show a clear summary instead of only “queue complete.”

Example:

```
Batch complete — 300 pages

Good                         251
Review                        18
Math Unsure                   14
Unclear                        5
Interrupted                    8
Failed                         4

Good = no warning signals detected.
It does not mean independently verified.
```

Required actions:

- **Spot-check Good pages**
- **Review flagged pages**
- **Review with External AI**
- **Resume Interrupted**
- **Retry Failed**
- **Export everything**

### Interrupted behavior

Resume Interrupted should:

- reuse the durable queue
- preserve queue order
- require credentials only when needed
- avoid treating temporary transport problems as transcription-quality failures

### Failed behavior

Retry Failed should:

- distinguish retryable work from configuration/authentication failures
- not encourage repeated requests with the same known-bad credentials/configuration
- preserve previous raw/final results where any exist

---

# 6. Good-Page Spot Checks and Reliability History

## Phase 3 — Make “Good” Honest

A Good page means only:

> no automatic warning signals were detected.

It is not a correctness claim.

After each batch, offer:

**Spot-check 5 Good pages**

Default sample size: 5.

The user may choose another size.

### Sampling rules

- random selection from the current batch/document scope
- do not repeatedly sample the same page unless the user requests it
- make the sample selection reproducible where practical by storing the sampled page IDs

### Spot-check result

For each sampled page, the human records:

- OK
- Error found
- optional note
- optional error category

Suggested error categories:

- wrong digit
- dropped sign/operator
- exponent/subscript error
- symbol/Greek-letter error
- missing text
- extra text
- formatting/LaTeX only
- other

### Reliability ledger

Persist every spot-check result with:

- page ID
- batch/run ID
- timestamp
- image hash
- provider
- model
- Primary/Secondary pass
- prompt fingerprint
- processing fingerprint
- whether Auto-fix was enabled
- whether High Assurance Math was enabled
- human outcome
- optional error type/note

### Reporting

Show earned counts such as:

> Across 40 spot-checked Good pages from this model/prompt, 37 were marked OK and 3 had errors.

Do not automatically present that as a formal “92.5% accuracy” score.

The sample is operational evidence, not necessarily a statistically representative benchmark.

### Why this matters

This creates real evidence for:

- whether Good is trustworthy enough for a given model/prompt
- whether Auto-fix adds value
- whether High Assurance Math is worth its additional cost
- which error types recur most often

---

# 7. External AI Round Trip

## Phase 4 — Export and Import Ship Together

Do not ship “Export problem pages to AI” without the return/import path.

The feature should be presented as:

**Review with External AI**

The application remains the source of truth.

External AI provides proposed corrections only.

## 7.1 Export problem pages

Allow export of:

- Review
- Math Unsure
- Unclear
- selected Failed pages where an image/transcription exists
- optionally user-selected pages

Do not include Interrupted pages whose only problem is transport failure unless the user explicitly asks.

### Chunking

Chat-friendly default:

- 10 pages per package

User-selectable:

- 5
- 10
- 20

Each package should include:

- stable page ID
- original image
- current final transcription
- raw transcription where useful
- deterministic warnings
- Math Unsure markers
- pile/reason
- page/document metadata
- a ready-made review prompt
- exact return schema

ZIP remains appropriate for archive/reproducibility, but the external-AI workflow should optimize for practical chat upload limits.

## 7.2 External review prompt

The generated prompt should explicitly instruct the outside AI:

- preserve the supplied page ID exactly
- return proposed corrected text
- explain uncertainty briefly if needed
- do not invent missing page IDs
- do not approve pages
- do not assign application pile/state
- do not silently remove uncertainty
- do not rewrite unrelated content merely for style

### Return format

Preferred minimal format:

```json
{
  "page_id": "abc123",
  "corrected_text": "proposed corrected transcription",
  "note": "Changed exponent 8 to 3 after checking source image."
}
```

For multiple pages, accept either:

- JSON array
- `{ "pages": [...] }`

Do not request a classification field.

---

# 8. External Correction Import

## Phase 4B — Safe Return Path

Imported external text is untrusted proposed text.

It never becomes Approved automatically.

It never directly controls the application's state.

### Tolerant parsing

Accept common chat-model output variations:

- Markdown JSON code fences
- prose before or after JSON
- JSON array
- `{ "pages": [...] }`
- unknown extra fields

Handle safely:

- unknown page IDs → ignore and report
- duplicate page IDs → flag for review
- malformed entries → report
- missing expected pages → report
- empty corrected text → reject/report

### Import report

Example:

```
External corrections loaded

Matched pages          13
Unknown page IDs        2
Malformed entries       1
Expected but missing    4
```

### Mandatory diff review

Importing a file must not immediately change final text.

For every matched proposal show:

`Current final ↔ Proposed external text`

with a visible diff.

Required actions:

- **Accept proposal**
- **Reject**
- **Edit proposal**

### Accept behavior

When accepted:

- push the old final text into revision history
- write the new final text
- preserve external proposal text separately in provenance
- record source as `External AI import`
- record import/package ID and timestamp
- run safe repair/validation/classification again
- Approved → Needs Reapproval
- never auto-Approve

### Reject behavior

Record that the proposal was reviewed and rejected.

Do not delete the proposal/provenance.

### External correction state

Do not add a permanent twelfth pile unless usage proves it is necessary.

Use the existing Review workflow with a clear reason such as:

`External correction proposed — human review required`

---

# 9. High Assurance Math

## Phase 5 — Optional Independent Verification

This combines the strongest remaining idea from the old roadmap with the new simplified UX.

High Assurance Math should be explicitly optional because it costs more.

### Candidate triggers

Use deterministic signals such as:

- high density of math spans
- equations with structural warnings
- MATH_UNSURE markers
- pages containing many superscripts/subscripts
- matrices/integrals/summations
- prior spot-check history showing recurring math errors for the current model/prompt

### Verification behavior

Possible strategies:

1. second full-page reading
2. targeted equation/region re-read
3. independent Math Verifier role over source crop + candidate text

The verifier must not receive hidden reasoning from the first model.

The verifier should see:

- source image/crop
- candidate transcription
- explicit task to identify disagreements/errors

It should return evidence, not approval.

### Result

- agreement is supporting evidence, not proof of correctness
- disagreement → Review
- no automatic winner

### Success metric

Use the spot-check ledger to compare:

- Quick Transcribe
- Auto-fix flagged pages
- High Assurance Math

by real human-observed error counts and extra AI cost.

---

# 10. Remaining Reliability / Infrastructure Work

## Phase 6 — Hardening Backlog

These are the best unfinished items from the original roadmap.

### 6.1 Durable targeted-region queue

Current limitation:

- completed targeted results persist
- an in-flight targeted-region request does not survive reload as a durable job

Goal:

- make targeted-region work use the same durable queue semantics as whole-page processing
- pause/resume/cancel
- persisted job state
- request identity
- transient retry history
- no duplicate launches

### 6.2 Project schema migrations

Current schema:

`math-photo-notes-project-v1`

Before introducing incompatible project fields:

- add explicit migration functions
- preserve older project data
- back up unsupported/corrupt state before recovery
- add migration fixtures to CI

### 6.3 Regression corpus expansion

Keep the current Playwright smoke suite as a release gate.

Expand with checked-in fixtures for:

- fractions
- radicals
- superscripts/subscripts
- Greek letters
- dropped minus/operator cases
- integrals
- matrices
- crossed-out handwriting
- rotated pages
- shadows/poor contrast
- blank pages
- long pages
- malformed LaTeX
- explicit Math Unsure
- truncation
- provider failure/recovery
- external correction import parsing/diff behavior
- spot-check persistence

The permanent regression:

`√x`

must never become:

`\sqrt{}x`

### 6.4 Self-host MathJax

Current state:

- CDN URL is pinned to MathJax 3.2.2

Production hardening goal:

- bundle/self-host the required MathJax assets
- remove third-party runtime script execution from the page where API keys are entered

### 6.5 Large archive improvements

Current archive:

- browser-generated
- store-only/uncompressed ZIP
- assembled in memory

For very large projects:

- stream archive generation where possible
- optionally compress entries
- show archive progress
- avoid browser-memory spikes

---

# 11. Useful Image-Preparation Work from the Old Plan

## Phase 7 — Optional Image Quality Tools

Only build these if spot-check/error history shows image quality is a meaningful source of errors.

Potential non-destructive tools:

- grayscale
- contrast
- brightness
- shadow reduction
- sharpen
- crop
- straighten
- automatic orientation suggestion

Always retain the original image.

Any processed image variant used for AI must receive its own processing fingerprint/provenance.

### Duplicate detection follow-up

Current cryptographic hashes catch exact duplicates.

Optional improvement:

- perceptual duplicate detection for resized/recompressed/near-identical photos

Never auto-delete a suspected duplicate without user confirmation.

---

# 12. Explicitly Retired / Changed Ideas from the Old Plan

## Numeric quality/confidence score

Do not prioritize a synthetic `87/100` transcription confidence score.

Observable warning signals, pile reasons, model disagreement, and human spot-check history are more defensible.

If a future score is introduced, it must be described as a review heuristic, not an accuracy probability.

## Automatic page-number reordering

Keep current behavior:

- suggestions only
- explicit human acceptance
- never silently reorder

## External AI classifications

Do not accept external AI classifications as authoritative application state.

The app owns classification and approval.

---

# 13. Delivery Order

Build in this order.

## Release A — Simplified Batch UX

1. Quick Transcribe default
2. rename/reframe auto-routing as Auto-fix flagged pages
3. High Assurance Math placeholder/toggle disabled until Phase 5
4. batch completion dashboard
5. Resume Interrupted
6. Retry Failed
7. Guided Review links from dashboard

### Acceptance criteria

- one obvious primary Process action
- Quick Transcribe never makes a semantic second-pass call
- transient retries still work
- browser smoke suite covers Quick Transcribe math happy path
- dashboard counts match actual piles

---

## Release B — Good Spot Checks

1. random Good-page sampling
2. spot-check review UI
3. OK/Error result capture
4. error categories/notes
5. persistent reliability ledger
6. model/prompt/processing provenance
7. reliability summary counts

### Acceptance criteria

- spot-check results survive reload/project Save/Open
- historical counts are tied to model + prompt fingerprint
- no claim of formal accuracy percentage

---

## Release C — External AI Round Trip

Ship export and import together.

1. problem-page selection
2. chat-friendly chunking
3. generated external-review prompt
4. stable page-ID return schema
5. tolerant import parser
6. import report
7. mandatory diff UI
8. Accept / Reject / Edit proposal
9. revision + provenance recording
10. deterministic revalidation after acceptance
11. Needs Reapproval protection

### Acceptance criteria

- importing data never changes final text before human acceptance
- unknown/missing/malformed pages are reported
- external AI cannot set Approved or any pile directly
- accepted corrections preserve earlier final text
- round-trip is covered by browser tests

---

## Release D — High Assurance Math

1. math-heavy deterministic trigger signals
2. configurable verification policy
3. second-model/Math-Verifier integration
4. disagreement review
5. cost preview
6. reliability-ledger comparison

### Acceptance criteria

- off by default
- no automatic winner
- extra AI usage is visible
- spot-check data can compare outcomes with/without the feature

---

## Release E — Infrastructure Hardening

1. durable targeted-region queue
2. project migration framework
3. expanded regression fixture corpus
4. self-host MathJax
5. streaming/compressed large archives
6. optional image-quality tools based on observed error data

---

# 14. Product Success Criteria

The next roadmap is successful when:

- a first-time user can process hundreds of images without learning the internal routing engine
- Quick Transcribe performs one semantic AI pass and stops cleanly
- flagged pages have obvious next actions
- Good pages are described honestly and can be spot-checked
- normal use accumulates real human-reviewed reliability evidence
- outside AI review can make a complete round trip back into the project
- every imported correction is diffed and human accepted/rejected
- Approved remains a human decision
- High Assurance Math can be evaluated using real error/cost evidence
- a local processing bug can never destroy a successful provider result
- browser CI exercises the normal math path before release

---

# 15. Long-Term Workflow

`Import → Process → preserve raw → repair/validate → classify → Batch Summary`

Then the user chooses:

`Spot-check Good`

or

`Review flagged`

or

`Review with External AI → Import proposals → Diff → Accept/Reject`

or

`High Assurance Math`

then:

`Approved → Export / Archive`

The system should remain conservative, provenance-first, and human-controlled.
