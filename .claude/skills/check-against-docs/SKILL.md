---
name: check-against-docs
description: Review a prototype (or a proposed change) against the design docs in docs/. Use when asked to check, review, or validate a prototype, or before calling prototype work done.
---

# Check Against Docs

Review the named prototype, or the current change, against the design docs. Report problems; don't fix them unless asked.

1. Read `docs/business-requirements.md`, `docs/position-data-model.md`, `docs/experience-principles.md`, and the relevant `docs/concept-*.md`.
2. Check for each of the following:
   - **Data model:** Does it produce the shape in `position-data-model.md`? Are unexplored values and acknowledged Drift kept separate? Is a partial position treated as complete?
   - **Content:** Is all framework content loaded from content files? Is anything from `content/real/` referenced, copied, or hardcoded?
   - **Neutrality:** Do copy, layout, color, ordering, or featured items frame any stance as better?
   - **No pestering:** Are there completion meters, "unlock" language, nudges, or urgency?
   - **Tone:** Approachable and clear, but not cutesy, and heavy topics handled plainly.
   - **Accessibility:** Keyboard access, text equivalents for visuals, labels on icons and masked text, color contrast, and no information conveyed by color alone.
   - **Privacy:** Nothing collected beyond what the position needs. No third-party analytics or trackers.
   - **Concept independence:** Is it borrowing structure or content from another concept?
3. Report findings briefly, grouped by doc, citing the section each finding relates to. Say explicitly when an area has no issues.
