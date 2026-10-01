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

**Status:** Implemented on 2026-09-30.

Implemented:

1. Quick Transcribe is the default user-facing batch workflow
2. automatic routing is reframed as **Auto-fix flagged pages**
3. a disabled **High Assurance Math** placeholder shows the future higher-assurance path without enabling it prematurely
4. the large power-user retry/routing surface is collapsed under **Advanced processing, retry & export controls**
5. completed runs produce a persisted batch summary scoped to the pages in that run
6. the summary shows Good / Review / Math Unsure / Unclear / Interrupted / Failed and Needs-* counts where present
7. the summary explicitly states that Good means no warning signals were detected, not independent verification
8. **Review flagged pages** opens Guided Review on flagged pages from that batch
9. **Resume Interrupted** reuses the durable queue and preserves each interrupted page's last Primary/Secondary pass where possible
10. **Retry Failed** skips known same-slot configuration/authentication failures and reports blocked pages
11. **Export everything** is available directly from the summary
12. batch-summary state persists through project autosave/Save/Open
13. browser smoke coverage now asserts that Quick Transcribe makes exactly one semantic provider call when Auto-fix is off

Acceptance criteria:

- one obvious primary Process action
- Quick Transcribe never makes a semantic second-pass call unless Auto-fix is explicitly enabled
- transient retries still work
- browser smoke suite covers Quick Transcribe and the math happy path
- dashboard counts are scoped to the completed run's actual page IDs
- failed retry does not blindly repeat a known same-slot auth/configuration failure

**Followed by:** Release B — Good Spot Checks.

---

## Release B — Good Spot Checks

**Status:** Implemented on 2026-09-30.

Implemented:

1. batch summaries can launch random Good-page spot checks
2. sample size is selectable: 1 / 5 / 10 / 20
3. previously checked Good pages are excluded from normal sampling
4. sampled page IDs are persisted with the active spot-check session
5. each page is reviewed source-image vs current final transcription
6. human outcomes are **Looks OK** or **Record error**
7. optional error categories cover wrong digits, signs/operators, exponents/subscripts, symbols/Greek letters, missing/extra text, formatting/LaTeX, and other
8. optional human notes are stored
9. Error-found pages move from Good to Review without changing transcription text
10. OK does not approve a page
11. every evidence record stores page/batch/session IDs, image hash, final-text hash, provider/model/pass, prompt fingerprint, processing fingerprint, Auto-fix setting, High Assurance setting, timestamp, outcome, category, and note
12. processing now stamps prompt fingerprint and batch assurance provenance on pages
13. spot-check ledger and active session persist through autosave and project Save/Open
14. accumulated evidence is grouped by provider/model/prompt fingerprint
15. UI reports raw human-reviewed counts, never a formal accuracy percentage
16. spot-check evidence is included in project archives and audit counts
17. spot-check evidence can be downloaded directly as JSON
18. Doctor reports human Good-page checks and errors found
19. browser CI verifies OK persistence/provenance and Error-found → Review behavior without transcription mutation

Acceptance criteria:

- spot-check results survive project serialization/hydration
- historical counts are tied to model + prompt fingerprint
- sampled IDs survive in the active session
- a human-found error cannot remain silently in Good
- no formal accuracy percentage is claimed

**Followed by:** Release C — External AI Round Trip.

---

## Release C — External AI Round Trip

**Status:** Implemented on 2026-09-30.

Export and import ship together.

Implemented:

1. **Review with External AI** is available from completed-batch summaries and Project / Export controls
2. eligible pages include Review / Math Unsure / Unclear / Needs Reapproval / Needs Refresh plus Failed pages that still have usable image/transcription evidence
3. Interrupted transport-only pages are excluded from the normal external-review scope
4. external review packages are chunked at 5 / 10 / 20 pages, default 10
5. each chunk receives a stable package ID and persisted expected page-ID list
6. each chunk ZIP contains:
   - source images where retained
   - stable page IDs
   - current final transcription
   - raw transcription where useful
   - deterministic warnings
   - Math Unsure details
   - page state/reason and metadata
   - `manifest.json`
   - ready-made `review-prompt.txt`
   - exact `return-template.json`
7. generated prompts explicitly prohibit external approval, application classification, invented page IDs, silent uncertainty removal, and unrelated stylistic rewriting
8. requested return data contains only package ID, page ID, proposed corrected text, and optional note
9. exported package history persists in the project so returned package IDs can be matched to expected pages
10. importer tolerates raw JSON, Markdown JSON fences, prose before/after JSON, arrays, `{ "pages": [...] }`, and unknown extra fields
11. importer reports matched, unknown, duplicate, malformed, and expected-but-missing pages
12. empty corrected text is rejected as malformed
13. external classification fields are ignored and never enter internal proposal state
14. importing creates pending proposals only; it does not modify page text or classification
15. every proposal is shown source image + current final + proposed external text + visible diff
16. proposal text is read-only until the human explicitly chooses **Edit proposal**
17. required decisions are **Accept**, **Reject**, or **Edit**
18. pending proposal sessions persist through autosave / project Save/Open and can be closed and resumed
19. accepted text:
   - preserves the previous final transcription as a revision when text actually changes
   - stores external proposal and accepted text in provenance
   - records package/source/import/decision timestamps
   - re-runs conservative LaTeX repair and deterministic classification
   - re-anchors review flags and targeted-region dependencies
   - preserves Needs Refresh rules
   - changes Approved / Needs Reapproval lineage to Needs Reapproval when text actually changes
   - never auto-Approves
20. accepting a no-op proposal does not unnecessarily invalidate approval
21. rejected proposals preserve current final text and record rejection provenance
22. external correction counts are included in the audit manifest and Doctor
23. external package export history is included in project archives
24. browser CI verifies:
   - stable package/return IDs
   - no requested classification field
   - tolerant fenced/prose parsing
   - no page mutation before acceptance
   - matched / unknown / missing reporting
   - mandatory diff review
   - editable proposal acceptance
   - revision/provenance preservation
   - external AI cannot approve
   - Approved → Needs Reapproval after a changed accepted correction
   - Reject leaves final text unchanged

Acceptance criteria:

- export and import are shipped as one complete workflow
- outside AI can propose text but cannot directly control application state
- importing alone cannot alter final text
- every accepted change is human-reviewed through a visible diff
- accepted changes preserve earlier transcription history and approval lineage
- malformed/unknown/missing/duplicate return data is reported instead of silently swallowed
- browser smoke tests cover accept, reject, and Approved-lineage behavior

**Followed by:** Release D — High Assurance Math.

### Post-Release-C hardening — 2026-09-30

Adversarial external-review testing found a math-specific transport hazard: JSON strings can legally reinterpret single-backslash LaTeX commands such as `\frac`, `\beta`, `\theta`, and `\neq` as JSON escape sequences before the app ever sees the intended math.

Hardening now implemented:

1. plain delimited external-return blocks are the preferred format:
   - `=== PACKAGE ... ===`
   - `=== PAGE ... ===`
   - literal corrected transcription
   - `=== NOTE ===`
   - `=== END ===`
2. LaTeX backslashes are preserved literally in the preferred return path
3. external review packages now include `return-template.txt` as the primary return template
4. JSON remains a compatibility fallback only
5. JSON fallback scans for unsafe single-backslash LaTeX commands before parsing and rejects them with a specific error rather than allowing silent control-character corruption
6. browser CI contains adversarial cases for `\frac`, `\beta`, `\theta`, `\neq`, and `\sqrt`
7. the Good-page reliability ledger now has its own IndexedDB store, independent from the current project
8. the browser DB version is upgraded to 2 to add the reliability store
9. project Save/Open keeps a portable ledger snapshot, but opening a project merges that evidence into the global ledger instead of replacing it
10. **Clear all** clears project pages/results while preserving accumulated reliability evidence
11. CI verifies reliability evidence survives **Clear all plus a full page reload**
12. external review export now offers:
    - ZIP package
    - **Loose images + text**
13. Loose mode produces one chat-ready context/prompt text file plus the source images as individual downloads, while ZIP remains the reproducible archive path

This hardening remains part of Release C's contract and should be regression-protected before Release D work.

---

## Release D — High Assurance Math

**Status:** Implemented on 2026-09-30.

High Assurance is an optional verification layer for pages that would otherwise be classified **Good**. It is not another correction mode and it never silently replaces the Primary transcription.

Implemented:

1. High Assurance is **off by default**
2. three verification policies are available:
   - **Math-heavy only** — default; deterministic math score must reach the configured built-in threshold
   - **Any detected math**
   - **All Good pages**
3. deterministic trigger signals include:
   - recognized math delimiters
   - complex LaTeX structures such as fractions, radicals, integrals, sums, limits, matrices, derivatives/partials
   - Greek/special symbols
   - superscripts/subscripts
   - mathematical relations/operators
   - display math
   - high symbolic density
4. verification only follows successful Primary processing that would otherwise land in Good; already flagged pages continue through the existing Review / Auto-fix workflow
5. a verification job is added to the **durable queue**
6. verification uses the Secondary AI slot and a **fresh independent call**
7. the verifier receives the original source image and project transcription rules, but **does not receive the Primary transcription or hidden reasoning**
8. Secondary credentials/configuration are validated before a High Assurance batch begins
9. verifier calls use the existing timeout, pause/resume, cancellation, and transient retry/backoff infrastructure
10. verifier jobs survive durable queue persistence/reload
11. Primary final text is never replaced by High Assurance automatically
12. each verification records:
    - provider/model
    - Secondary pass
    - batch ID/timestamps
    - selected policy
    - deterministic trigger score/signals
    - verifier prompt fingerprint
    - raw verifier transcription
    - mechanically repaired verifier transcription
    - validation warnings
    - verifier classification/reason
    - truncation/stop metadata
    - usage metadata
    - Primary text hash at queue time
    - current Primary text hash at comparison time
    - deterministic comparison details
13. comparison separates:
    - normalized math payloads
    - prose with math replaced by placeholders
    - whole-text similarity
14. formatting-only delimiter/whitespace differences such as `$...# Math Photo to Notes — Product Roadmap

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

**Status:** Implemented on 2026-09-30.

Implemented:

1. Quick Transcribe is the default user-facing batch workflow
2. automatic routing is reframed as **Auto-fix flagged pages**
3. a disabled **High Assurance Math** placeholder shows the future higher-assurance path without enabling it prematurely
4. the large power-user retry/routing surface is collapsed under **Advanced processing, retry & export controls**
5. completed runs produce a persisted batch summary scoped to the pages in that run
6. the summary shows Good / Review / Math Unsure / Unclear / Interrupted / Failed and Needs-* counts where present
7. the summary explicitly states that Good means no warning signals were detected, not independent verification
8. **Review flagged pages** opens Guided Review on flagged pages from that batch
9. **Resume Interrupted** reuses the durable queue and preserves each interrupted page's last Primary/Secondary pass where possible
10. **Retry Failed** skips known same-slot configuration/authentication failures and reports blocked pages
11. **Export everything** is available directly from the summary
12. batch-summary state persists through project autosave/Save/Open
13. browser smoke coverage now asserts that Quick Transcribe makes exactly one semantic provider call when Auto-fix is off

Acceptance criteria:

- one obvious primary Process action
- Quick Transcribe never makes a semantic second-pass call unless Auto-fix is explicitly enabled
- transient retries still work
- browser smoke suite covers Quick Transcribe and the math happy path
- dashboard counts are scoped to the completed run's actual page IDs
- failed retry does not blindly repeat a known same-slot auth/configuration failure

**Followed by:** Release B — Good Spot Checks.

---

## Release B — Good Spot Checks

**Status:** Implemented on 2026-09-30.

Implemented:

1. batch summaries can launch random Good-page spot checks
2. sample size is selectable: 1 / 5 / 10 / 20
3. previously checked Good pages are excluded from normal sampling
4. sampled page IDs are persisted with the active spot-check session
5. each page is reviewed source-image vs current final transcription
6. human outcomes are **Looks OK** or **Record error**
7. optional error categories cover wrong digits, signs/operators, exponents/subscripts, symbols/Greek letters, missing/extra text, formatting/LaTeX, and other
8. optional human notes are stored
9. Error-found pages move from Good to Review without changing transcription text
10. OK does not approve a page
11. every evidence record stores page/batch/session IDs, image hash, final-text hash, provider/model/pass, prompt fingerprint, processing fingerprint, Auto-fix setting, High Assurance setting, timestamp, outcome, category, and note
12. processing now stamps prompt fingerprint and batch assurance provenance on pages
13. spot-check ledger and active session persist through autosave and project Save/Open
14. accumulated evidence is grouped by provider/model/prompt fingerprint
15. UI reports raw human-reviewed counts, never a formal accuracy percentage
16. spot-check evidence is included in project archives and audit counts
17. spot-check evidence can be downloaded directly as JSON
18. Doctor reports human Good-page checks and errors found
19. browser CI verifies OK persistence/provenance and Error-found → Review behavior without transcription mutation

Acceptance criteria:

- spot-check results survive project serialization/hydration
- historical counts are tied to model + prompt fingerprint
- sampled IDs survive in the active session
- a human-found error cannot remain silently in Good
- no formal accuracy percentage is claimed

**Followed by:** Release C — External AI Round Trip.

---

## Release C — External AI Round Trip

**Status:** Implemented on 2026-09-30.

Export and import ship together.

Implemented:

1. **Review with External AI** is available from completed-batch summaries and Project / Export controls
2. eligible pages include Review / Math Unsure / Unclear / Needs Reapproval / Needs Refresh plus Failed pages that still have usable image/transcription evidence
3. Interrupted transport-only pages are excluded from the normal external-review scope
4. external review packages are chunked at 5 / 10 / 20 pages, default 10
5. each chunk receives a stable package ID and persisted expected page-ID list
6. each chunk ZIP contains:
   - source images where retained
   - stable page IDs
   - current final transcription
   - raw transcription where useful
   - deterministic warnings
   - Math Unsure details
   - page state/reason and metadata
   - `manifest.json`
   - ready-made `review-prompt.txt`
   - exact `return-template.json`
7. generated prompts explicitly prohibit external approval, application classification, invented page IDs, silent uncertainty removal, and unrelated stylistic rewriting
8. requested return data contains only package ID, page ID, proposed corrected text, and optional note
9. exported package history persists in the project so returned package IDs can be matched to expected pages
10. importer tolerates raw JSON, Markdown JSON fences, prose before/after JSON, arrays, `{ "pages": [...] }`, and unknown extra fields
11. importer reports matched, unknown, duplicate, malformed, and expected-but-missing pages
12. empty corrected text is rejected as malformed
13. external classification fields are ignored and never enter internal proposal state
14. importing creates pending proposals only; it does not modify page text or classification
15. every proposal is shown source image + current final + proposed external text + visible diff
16. proposal text is read-only until the human explicitly chooses **Edit proposal**
17. required decisions are **Accept**, **Reject**, or **Edit**
18. pending proposal sessions persist through autosave / project Save/Open and can be closed and resumed
19. accepted text:
   - preserves the previous final transcription as a revision when text actually changes
   - stores external proposal and accepted text in provenance
   - records package/source/import/decision timestamps
   - re-runs conservative LaTeX repair and deterministic classification
   - re-anchors review flags and targeted-region dependencies
   - preserves Needs Refresh rules
   - changes Approved / Needs Reapproval lineage to Needs Reapproval when text actually changes
   - never auto-Approves
20. accepting a no-op proposal does not unnecessarily invalidate approval
21. rejected proposals preserve current final text and record rejection provenance
22. external correction counts are included in the audit manifest and Doctor
23. external package export history is included in project archives
24. browser CI verifies:
   - stable package/return IDs
   - no requested classification field
   - tolerant fenced/prose parsing
   - no page mutation before acceptance
   - matched / unknown / missing reporting
   - mandatory diff review
   - editable proposal acceptance
   - revision/provenance preservation
   - external AI cannot approve
   - Approved → Needs Reapproval after a changed accepted correction
   - Reject leaves final text unchanged

Acceptance criteria:

- export and import are shipped as one complete workflow
- outside AI can propose text but cannot directly control application state
- importing alone cannot alter final text
- every accepted change is human-reviewed through a visible diff
- accepted changes preserve earlier transcription history and approval lineage
- malformed/unknown/missing/duplicate return data is reported instead of silently swallowed
- browser smoke tests cover accept, reject, and Approved-lineage behavior

**Followed by:** Release D — High Assurance Math.

### Post-Release-C hardening — 2026-09-30

Adversarial external-review testing found a math-specific transport hazard: JSON strings can legally reinterpret single-backslash LaTeX commands such as `\frac`, `\beta`, `\theta`, and `\neq` as JSON escape sequences before the app ever sees the intended math.

Hardening now implemented:

1. plain delimited external-return blocks are the preferred format:
   - `=== PACKAGE ... ===`
   - `=== PAGE ... ===`
   - literal corrected transcription
   - `=== NOTE ===`
   - `=== END ===`
2. LaTeX backslashes are preserved literally in the preferred return path
3. external review packages now include `return-template.txt` as the primary return template
4. JSON remains a compatibility fallback only
5. JSON fallback scans for unsafe single-backslash LaTeX commands before parsing and rejects them with a specific error rather than allowing silent control-character corruption
6. browser CI contains adversarial cases for `\frac`, `\beta`, `\theta`, `\neq`, and `\sqrt`
7. the Good-page reliability ledger now has its own IndexedDB store, independent from the current project
8. the browser DB version is upgraded to 2 to add the reliability store
9. project Save/Open keeps a portable ledger snapshot, but opening a project merges that evidence into the global ledger instead of replacing it
10. **Clear all** clears project pages/results while preserving accumulated reliability evidence
11. CI verifies reliability evidence survives **Clear all plus a full page reload**
12. external review export now offers:
    - ZIP package
    - **Loose images + text**
13. Loose mode produces one chat-ready context/prompt text file plus the source images as individual downloads, while ZIP remains the reproducible archive path

This hardening remains part of Release C's contract and should be regression-protected before Release D work.

---

 versus `\(...\)` do not create a false disagreement when the math/prose content matches
15. semantic math differences such as a changed sign/operator remain disagreements
16. a disagreement, verifier warning, truncation, or non-Good verifier result moves an otherwise Good page to **Review**
17. disagreement preserves both readings and explicitly selects **no winner**
18. High Assurance disagreement is a human-review stop: it is **not fed into Auto-fix**, even when Auto-fix is enabled for the same batch
19. verifier failure preserves the Primary text and routes the page to Review; verifier cancellation preserves the Primary result without inventing a replacement
20. if Primary text changes after a verifier was queued, the stale verifier result is preserved as evidence but cannot change page state
21. page cards show High Assurance status, attempts, trigger provenance, comparison summary, and the independent verifier reading
22. batch summaries report assurance verified / disagreement / failed counts
23. usage reports include verifier calls with scope `high-assurance`
24. cost preview shows the maximum possible additional Secondary-call count before processing and, when historical priced usage exists, a historical average cost/call plus maximum estimate
25. audit/archive output preserves High Assurance status and per-page `high-assurance-checks.json`
26. Doctor reports current High Assurance configuration and accumulated results
27. Good-page spot-check evidence distinguishes:
    - High Assurance requested
    - actually High Assurance verified
    - verification policy/status
28. reliability groups separate standard Good pages from actually verified Good pages by provider/model/prompt/policy, allowing the feature's real value to be evaluated from human checks
29. browser CI covers:
    - deterministic math trigger behavior
    - formatting-only comparison normalization
    - sign-level math disagreement
    - agreement path with exactly one Primary + one Secondary call
    - disagreement preserving Primary text
    - disagreement → Review
    - no normal Secondary-attempt counter pollution
    - no Auto-fix continuation after assurance disagreement
    - verifier provenance/usage visibility
    - batch-summary policy persistence
    - spot-check/reliability labeling of actual verification
    - visible expandable verifier evidence

### Acceptance criteria

- High Assurance is off by default
- verification uses an independent Secondary reading
- Primary text is never automatically replaced
- model disagreement never has an automatic winner
- disagreement stops at human Review even when Auto-fix is enabled
- extra AI usage and potential added cost are visible
- stale verifier results cannot mutate newer Primary text
- spot-check data can compare actually verified Good pages with standard Good pages
- browser smoke tests exercise agreement and disagreement end to end

**Followed by:** Release E — Infrastructure Hardening.

---

## Release E — Infrastructure Hardening

**Status:** Implemented on 2026-09-30.

Implemented:

1. **Durable targeted-region queue**
   - targeted region/equation work is represented as explicit durable queue jobs
   - running targeted-region work serializes as resumable pending work
   - restored projects resume safely rather than relaunching duplicate hidden requests
   - region job identity/provider/pass/freshness metadata persists with the queue
   - targeted work uses the same pause/resume/cancel and interruption rules as whole-page processing

2. **Explicit project-schema migration framework**
   - current project version is v2
   - older v1 envelopes are migrated through explicit migration code
   - migration history is recorded
   - durable job kinds / targeted-region persistence are normalized during migration
   - browser regression fixtures cover v1 → v2 migration behavior

3. **Expanded checked-in regression corpus**
   - `tests/fixtures/browser-regressions.json` carries deterministic cases for repair/classification/validation/High Assurance/page-number/migration behavior
   - the Chromium smoke suite executes the fixture corpus, not only inline assertions

4. **Self-hosted MathJax**
   - normal development/browser mode loads MathJax JavaScript and CHTML webfonts from the repository's local `vendor/mathjax` tree
   - missing `core.js` dependency was identified by the rendered-browser gate and added
   - PDF/print export no longer uses remote jsDelivr MathJax
   - CI asserts no remote executable MathJax script is requested
   - the live preview is verified by waiting for actual rendered `mjx-container` output and local font requests

5. **EquationWright-style single-file offline build**
   - reused the proven `tex-svg.js` strategy from `steveonw/equationwright`
   - `scripts/fetch_mathjax.py` fetches MathJax 3.2.2 `tex-svg.js` and verifies the exact pinned Git blob SHA-1 `aed2086b6c27920ec2c15399cf6d773b33c892b3`
   - `make_offline_build.py` embeds that bundle directly into a single HTML file
   - the generated offline edition needs no MathJax network request or companion MathJax folder
   - live preview uses SVG output in the offline edition
   - PDF/print export detects and reuses the embedded bundle rather than reaching for external assets
   - CI builds `photo_to_text_OFFLINE.html` and reruns the full Chromium smoke suite against it

6. **Memory-friendlier compressed archive generation**
   - large archive output uses per-entry compression where supported instead of relying only on a fully concatenated uncompressed ZIP
   - CompressionStream-backed DEFLATE is used where available
   - archive progress remains visible to the user
   - browser tests cover large archive writer behavior

7. **Evidence-driven, non-destructive image review assist**
   - image-quality evidence can recommend display-only review transforms
   - available assistance includes non-destructive review presentation such as grayscale/contrast/brightness-style viewing support where warranted
   - the original image remains authoritative and unchanged
   - the feature is intentionally review/display assistance rather than automatic evidence mutation
   - browser regression coverage verifies that recommendations require observable image-quality evidence

8. **Release gate**
   - regular `photo_to_text.html` Chromium smoke suite passes
   - pinned MathJax fetch/hash verification passes
   - one-file offline build passes
   - full Chromium smoke suite also passes against the generated offline edition

### Acceptance criteria

- targeted-region work is durably resumable
- old project envelopes have explicit migrations rather than ad-hoc field assumptions
- checked-in regression fixtures exercise math and migration behavior
- no runtime path requires third-party MathJax execution
- a one-file MathJax-capable offline build is reproducible from pinned source
- large archives have a compressed/memory-aware path
- image-quality assistance never destroys or silently replaces original evidence
- both normal and generated offline editions pass browser CI

**Roadmap status:** Releases A–E are complete. Remaining work is evidence-driven maintenance, bug fixes, fixture expansion, and product refinements rather than an invented Release F.

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
