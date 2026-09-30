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

## Phase B — AI Routing

1. Primary/Secondary configuration
2. per-pile AI choice
3. automatic secondary routing toggle
4. retry limits
5. model history
6. provider error handling
7. rate-limit handling

## Phase C — Math Review

1. MathJax live preview
2. EquationWright validation
3. structured Math Unsure markers
4. highlight malformed math
5. math-specific warning categories

## Phase D — Human Review Interface

1. side-by-side review
2. image zoom
3. rotation
4. keyboard shortcuts
5. approve/unapprove workflow
6. previous/next navigation

## Phase E — Batch Scale

1. concurrency control
2. queue manager
3. pause/resume
4. duplicate detection
5. page ordering
6. retry/backoff system

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

## Phase H — Export and Archival

1. Markdown export
2. `.tex` export
3. MathJax PDF
4. project save/load
5. ZIP archive
6. usage/cost report

---

# PART 15 — Recommended Build Order

### Upgrade 1
Approved state + revision history + raw/repaired/final text.

### Upgrade 2
API truncation detection + retry counters + provider error handling.

### Upgrade 3
Live MathJax preview + stronger EquationWright validation.

### Upgrade 4
Side-by-side review interface.

### Upgrade 5
Queue manager + concurrency + pause/resume.

### Upgrade 6
Document organization + page ordering.

### Upgrade 7
Automatic Primary/Secondary routing.

### Upgrade 8
Equation-only retries and model disagreement checking.

### Upgrade 9
Project persistence + full export/archive system.

---

# Design Principle

**Never silently replace uncertainty with confidence.**

When the system knows what it can safely repair, it should repair it.

When it has a plausible interpretation but is uncertain, it should show:

`(I think it says: ...)`

When it cannot determine the content reliably, it should send that page to the appropriate review pile.

The final workflow becomes:

`Import → Primary AI → classify → safe repair → secondary AI where appropriate → human review → Approved → export`

with the original image, original AI response, repair history, and previous versions always recoverable.
