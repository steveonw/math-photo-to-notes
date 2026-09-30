# AI Handoff Sheet — Photo-to-Text Upgrade Project

## Project

Browser-based bulk photo-to-text transcription tool derived from:

`https://github.com/steveonw/study-suite`

Relevant source tool:

`photo_to_text.html`

Additional LaTeX-repair ideas may be borrowed from:

`https://github.com/steveonw/equationwright`

The user owns the EquationWright repository and has explicitly said its code may be reused for this project.

---

# Current Goal

Turn the existing photo-to-text utility into a reliable bulk transcription system for handwritten/printed notes, especially math-heavy notes.

Primary concerns:

1. preserve original text faithfully
2. preserve mathematical notation
3. never silently guess uncertain math
4. automatically separate questionable pages
5. support cheap first-pass AI and stronger second-pass AI
6. preserve earlier results during retries
7. provide MathJax/PDF export
8. scale to large batches

---

# Current Processing Piles

The system currently uses:

- Queued
- Running
- Good
- Review
- Unclear
- Math Unsure
- Failed

Planned additional state:

- Approved

### Good
No obvious automatic warning signs.

### Review
The request succeeded but something looks suspicious.

### Unclear
The AI explicitly reports unreadable normal text.

Marker:

`[unclear]`

or:

`[No readable text found]`

### Math Unsure
The AI is uncertain about a mathematical symbol, operator, exponent, variable, bound, radical, fraction, or equation structure.

Required format:

`[MATH_UNSURE: seen="..." guess="..." note="..."] (I think it says: ...)`

### Failed
API/network/provider failure.

### Approved
Planned state meaning a human reviewed the page and considers it complete.

Approved pages should be protected from automatic reprocessing.

---

# AI Configuration

There are two independently configurable AI slots.

## Primary AI

Used for normal first-pass processing.

Configurable:

- provider
- model
- API key
- compatible base URL
- prompt

## Secondary AI

Used for retries / difficult pages.

Same configurable fields.

The user specifically wants both Primary and Secondary to remain changeable.

---

# Per-Pile AI Routing

Each problem pile should have its own selector:

- Review → Primary or Secondary
- Unclear → Primary or Secondary
- Math Unsure → Primary or Secondary
- Failed → Primary or Secondary
- Current pile → Primary or Secondary

The user does NOT want one global retry model choice.

Each pile's selection should persist locally.

---

# Math Handling Rules

Prefer LaTeX notation.

Preserve:

- fractions
- radicals
- exponents
- subscripts
- Greek letters
- limits
- integrals
- summations
- matrices
- derivatives
- partial derivatives
- equation alignment

---

# Math Uncertainty Rule

Do not silently guess.

If uncertain, preserve the uncertainty marker and include a possible interpretation.

Required style:

`[MATH_UNSURE: ...] (I think it says: ...)`

The possible guess must remain visibly a guess.

---

# LaTeX Repair Philosophy

EquationWright may be used as inspiration/source for common LaTeX cleanup.

## Safe automatic repairs are allowed

Examples:

- Unicode minus → ASCII minus
- `×` → `\times`
- `π` → `\pi`
- `∞` → `\infty`
- `≤` → `\le`
- `≥` → `\ge`
- malformed/doubled MathJax delimiters
- obvious missing command backslashes inside known math spans
- control-character cleanup

## Unsafe semantic repairs are NOT allowed

Important prior bug:

`√x`

was previously changed to:

`\sqrt{}x`

This is NOT acceptable because it changes the structure.

If radical scope is uncertain:

- preserve it
- raise a Math Unsure warning

---

# EquationWright Validation Ideas

Useful validation targets include:

- unmatched `{ }`
- unmatched `\(` `\)`
- unmatched `\[` `\]`
- unmatched `$$`
- malformed `\frac`
- malformed `\sqrt`
- incomplete superscripts
- incomplete subscripts
- broken matrix environments
- mismatched `\begin{}` and `\end{}`
- suspicious missing command backslashes
- malformed integral bounds

Distinguish:

### Repair
Safe mechanical transformation.

### Warning
Needs review because mathematical intent is uncertain.

Warnings should push the page toward Math Unsure rather than silently fixing the expression.

---

# MathJax / PDF

The tool should support PDF export with MathJax rendering.

Important security/design choice:

Do NOT load remote MathJax JavaScript on the main application page where API keys are present.

Instead:

- keep the application page self-contained
- load MathJax only in the detached print/PDF window
- set `window.opener = null` on the print window if possible

---

# Version Preservation

Retries should never destroy earlier successful results.

Planned per-image versions:

1. raw AI transcription
2. repaired transcription
3. final edited transcription

Also maintain retry history.

Required controls:

- Restore previous
- View raw
- View repaired
- View final
- Compare versions

---

# Current Known Fixes Already Made

A prior review of the HTML found and fixed several issues:

1. JavaScript syntax was valid.
2. Math Unsure classification existed but the active prompt had lost the instructions that generated the marker.
3. Old prompts stored in `localStorage` could override newer prompt changes.
4. The radical repair could change math meaning.
5. Some repairs were being applied outside math spans.
6. retries could overwrite earlier successful transcriptions.
7. Process Batch could re-run questionable completed pages instead of only queued pages.
8. Current-pile retry had been hard-coded to Primary.
9. remote MathJax was loaded in the main API-key page.
10. empty retry piles could unnecessarily trigger API-key validation.

Do not reintroduce these bugs.

---

# Next Recommended Development Phase

## Phase A — Reliability Foundation

Build next:

- Approved state
- raw/repaired/final versions
- full revision history
- API truncation detection
- retry counters
- stronger LaTeX structural validation
- autosave

---

# Later Upgrade Phases

## Phase B — AI Routing
- optional automatic rerouting
- per-pile model choice
- retry limits
- provider error handling
- rate-limit handling

## Phase C — Math Review
- live MathJax preview
- EquationWright validation
- math-error highlighting
- math-specific warning categories

## Phase D — Human Review UI
- image/transcription side-by-side
- zoom
- rotation
- keyboard shortcuts
- approve/unapprove
- next/previous navigation

## Phase E — Batch Scale
- concurrency control
- pause/resume
- queue manager
- rate-limit backoff
- duplicate detection

## Phase F — Organization
- document/notebook groups
- page ordering
- page-number detection
- metadata/tags

## Phase G — Advanced AI Review
- equation-only retries
- cropped-region reprocessing
- Primary/Secondary disagreement detection
- optional dual-model transcription

## Phase H — Export / Archive
- Markdown
- `.tex`
- PDF
- plain text
- project save/load
- ZIP archive
- cost/usage report

---

# Desired Long-Term Workflow

`Import → Primary AI → automatic classification → safe LaTeX repair → Good / Review / Unclear / Math Unsure / Failed → selected Primary/Secondary retry per pile → human correction → Approved → export`

---

# Core Design Principle

Never silently replace uncertainty with confidence.

If the software knows a repair is mechanically safe, repair it.

If the AI has a plausible interpretation but is uncertain, show:

`(I think it says: ...)`

If mathematical meaning cannot be determined safely, route it to:

`Math Unsure`

Always keep the original image, raw AI result, repair history, and earlier revisions recoverable.

---

# Development Constraint

Prefer incremental upgrades over rewriting the entire application at once.

Each phase should:

1. preserve existing behavior
2. add one coherent capability
3. be code-reviewed
4. be tested against math-heavy and ordinary-note examples
5. avoid semantic alteration of source notes
