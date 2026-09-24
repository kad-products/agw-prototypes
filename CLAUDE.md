# AI Positions Map

A tool that helps people capture and see their many-sided position on AI, built on Karen Boyd's Stances and Values framework (*Amplify Good Work*). This repo currently holds **throwaway prototypes** used to test UX concepts.

## Source of Truth

The design docs in `docs/` define what's being built. Read the relevant ones before starting any work, and check work against them.

- `docs/business-requirements.md`: goals, non-goals, constraints, data and privacy
- `docs/position-data-model.md`: the data shape every concept must produce
- `docs/experience-principles.md`: tone, reflect-back, and layer entry
- `docs/prototype-plan.md`: phases, content management, and what each phase should teach
- `docs/concept-*.md`: one doc per UX concept (survey, statements, adventure, character builder, map)

If a request conflicts with the docs, say so before building. Don't quietly pick one.

## Non-Negotiables

- **Never commit real framework content.** Karen's framework content lives only in `content/real/`, which is gitignored. Never force-add it, copy it elsewhere, or paste it into code, tests, commit messages, or fake content. Git history keeps everything.
- **Don't read or edit `content/real/`.** Framework use hasn't been agreed yet. The app loads it at runtime, and Claude doesn't need to see it.
- **The repo stays private** until framework use is agreed with the author.
- **Accessibility:** WCAG 2.2 AA minimum, and AAA wherever feasible. Every visual element needs a text equivalent. Masked profanity needs an accessible label.
- **No stance is framed as better.** This applies to copy, layout, color, and ordering.
- **No pestering:** No completion meters, "unlock" language, or nudges to go deeper.

## Prototype Conventions

- **Code is throwaway.** Optimize for learning speed, not production quality. Don't add infrastructure the prototype doesn't need.
- **Concepts are independent.** Each prototype shares only the data model with the others, not content, structure, or components, unless explicitly asked.
- **Content comes from content files**, never hardcoded. Swapping `content/fake/` for `content/real/` must require no code changes.
- **Record learnings.** When a prototype phase ends, help write notes on what worked, what didn't, and what was surprising.

## Layout

```
docs/              design docs (source of truth)
prototypes/<name>/ one folder per concept prototype
content/fake/      invented content, committed
content/real/      Karen's framework content, gitignored, local only
```

## Working Style

- Keep answers brief and stick to what was asked.
- Ask clarifying questions when a request is unclear.
- Be direct when an approach seems off, and suggest better options. Don't agree without analyzing.
- When recommending how to use a technology (a package, a GitHub workflow, etc.), link to its documentation.
