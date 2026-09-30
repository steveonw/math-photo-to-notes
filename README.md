# Math Photo to Notes

A browser-based bulk photo-to-text transcription tool for handwritten and printed notes, with special support for mathematical notation.

This project is based on the photo-to-text workflow from `steveonw/study-suite` and incorporates LaTeX cleanup/validation ideas from `steveonw/equationwright`.

## Current capabilities

- Batch image transcription
- Primary and Secondary AI configurations
- Per-pile AI retry routing
- Good / Review / Unclear / Math Unsure / Failed piles
- Structured math uncertainty markers
- Conservative LaTeX cleanup
- MathJax-based PDF export
- Previous-result restoration
- Manual pile assignment
- Markdown export

## Main file

Open:

`photo_to_text.html`

directly in a modern browser.

## Project docs

- [Upgrade Plan](UPGRADE_PLAN.md)
- [AI Handoff Sheet](AI_HANDOFF.md)

## Core design principle

Never silently replace uncertainty with confidence.

Safe mechanical repairs may be applied automatically. Ambiguous mathematical content should remain visibly uncertain and be routed to review rather than guessed.

## Status

The current HTML is the latest reviewed/fixed build from the ongoing upgrade work. See the upgrade plan for the next milestones.
