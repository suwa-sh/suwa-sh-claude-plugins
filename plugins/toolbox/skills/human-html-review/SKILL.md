---
name: toolbox:human-html-review
description: Create a self-contained, decision-ready HTML review that rebuilds the reviewer’s mental model from zero context. Use for autonomous coding-agent results, implementation or design reviews, plan reviews, architecture changes, research artifacts, and option-selection decisions where a human must understand background, alternatives, the review target’s structure/behavior/data model, evidence, risks, and what happens after approval or selection.
metadata:
  dependencies:
    - diagram-design # https://github.com/cathrynlavery/diagram-design — install: npx skills add cathrynlavery/diagram-design
---

# Human HTML Review

Create a derived review view that lets a reviewer move from no prior context to a defensible decision. Keep Git, the PR, CI, specifications, and source files as the system of record.

## Inputs and defaults

Treat `$ARGUMENTS` as a review target plus optional decision mode, base/head revision, and output path. If no target is supplied, review the current repository change.

Examples:

```text
$human-html-review current changes --mode approval
$human-html-review choose auth migration approach --mode selection
$human-html-review PR 123 --output tmp/reviews/pr-123.html
```

- Use `approval` when the reviewer must accept or request changes to a completed result.
- Use `selection` when the reviewer must choose among open alternatives.
- Infer the mode from the request when clear. If still ambiguous, use `approval` and state the assumption in the review contract.
- Default the output to `tmp/reviews/<target>-review.html` under the current repository.
- Do not overwrite an existing review unless explicitly requested. Add a revision suffix instead.
- Do not commit, publish, deploy, or record formal approval unless explicitly requested.

Before creating the review, read [references/review-contract.md](references/review-contract.md) completely. Copy and adapt [assets/review-template.html](assets/review-template.html); do not recreate its layout from scratch.

## Dependencies

### diagram-design (required for the step-4 diagrams)

Every diagram in this skill (structure / behavior / data model, step 4) must follow the **diagram-design** skill: its style-guide tokens, node treatments, mandatory connector rules, complexity budget, and pre-output taste gate. Map the three views to its types:

| View | diagram-design type reference |
|---|---|
| Structure | `references/type-architecture.md` |
| Behavior | `references/type-flowchart.md` (or `type-sequence.md` / `type-state.md` when message order / state transitions dominate) |
| Data model | `references/type-er.md` |

**Availability check (run before step 4):** verify the skill exists at `~/.claude/skills/diagram-design/SKILL.md` or the project's `.claude/skills/diagram-design/SKILL.md`. If it is missing, present exactly this to the user and ask whether to install:

> The `diagram-design` skill is not installed. It is required for the review diagrams.
>
> - Source: <https://github.com/cathrynlavery/diagram-design>
> - Security audits: <https://skills.sh/cathrynlavery/diagram-design>
> - Install: `npx skills add cathrynlavery/diagram-design`

If the user declines, fall back to plain inline SVG following [references/review-contract.md](references/review-contract.md) only, and record `diagram-design: not installed (fallback)` in the review contract section.

**Constraint reconciliation — this skill wins on conflicts:**

- **No external assets.** Do not include diagram-design's Google Fonts `<link>`. Use system font stacks instead (sans: `"Hiragino Sans","Noto Sans JP",Inter,system-ui,sans-serif`; mono: `"SF Mono",Menlo,Consolas,monospace`).
- **One self-contained file.** Embed each diagram as inline SVG inside the review HTML. Do not emit separate diagram-design `.html` files.
- **Accessibility stays.** Keep `role="img"`, accessible names, and the text explanation below each figure as required by the review contract.

## Workflow

### 1. Establish the review contract

State at the top:

- decision mode: `approval` or `selection`
- the exact decision requested from the human
- review target and base/head revision
- purpose, success criteria, constraints, scope, and omitted scope
- known unknowns and evidence that is unavailable

Do not start with code, a diff summary, or an agent transcript.

### 2. Ground every claim

Inspect the sources that produced the result: repository instructions, relevant specification or issue, source code, base/head diff, schemas, tests, commands, logs, screenshots, and prior decisions that remain material.

Build an evidence ledger before writing HTML. Classify statements as:

- `observed`: directly supported by code, diff, command output, schema, or another primary artifact
- `agent-claim`: reported by the producing agent but not independently established
- `inference`: a reasoned interpretation; label the premises
- `human-decision`: reserved for the reviewer

Never invent missing background or diagram edges. Mark gaps as `unknown` or `unverified`.

### 3. Build a causal timeline

Use the main narrative order:

1. trigger and purpose
2. constraints and success criteria
3. alternatives considered
4. adopted result or currently open options
5. the review target itself
6. verification and exceptions
7. human decision
8. what happens after that decision

Summarize only events that explain the decision. Do not reproduce the chronological work log.

### 4. Explain the review target after the adopted result or options

Create all three views for the decision-relevant slice:

1. **Structure**: components, responsibilities, dependencies, boundaries, and changed nodes.
2. **Behavior**: trigger, main path, output, side effects, failure paths, and before/after behavior.
3. **Data model**: entities, relationships, ownership, persistence, lifecycle/state transitions, and migration effects.

Draw all three views with the **diagram-design** skill (see Dependencies): run its availability check first, load its SKILL.md plus the matching `references/type-*.md` before drawing, apply its style-guide tokens and mandatory connector rules, and run its pre-output taste gate on each figure. Use inline SVG with readable text. Keep every node labeled and connected. Mark observed facts and inference distinctly, and link diagram elements to source anchors where practical. State diagram boundaries and omitted areas.

### 5. Present evidence after the target model

Place evidence next to the claim or model element it supports. Show command, scope, revision, exit status, and exclusions—not only “tests pass.”

Keep these visible without opening a disclosure:

- failures and warnings
- `not-run`, `unknown`, and `unverified`
- destructive, permission, data migration, external contract, and security changes
- stale evidence or revision mismatch
- unresolved reviewer questions

Fold only repetitive successful logs or low-risk supporting detail. Provide a route to raw evidence.

### 6. Render the decision branch

For `approval`:

- show the adopted result, residual risks, and blocking/non-blocking findings
- offer `Approve` and `Request changes` as distinct actions or annotation targets
- explain what approval triggers and what remains reversible

For `selection`:

- compare at least two real options without weakening non-recommended options
- for every option, show user outcome, structure, behavior, data effects, cost, risks/unknowns, reversibility, and next action
- explain the resulting state after each choice, not only feature differences
- state which assumptions or evaluation axes would change the recommendation
- explain what the agent and human will do after selection

### 7. Generate one self-contained HTML file

Adapt the bundled template in one complete write.

- Set `<html lang>` and a descriptive `<title>`.
- Keep inline CSS and inline SVG; do not use external assets, fonts, Mermaid runtimes, CDNs, iframes, forms, or JavaScript.
- Preserve semantic headings, landmarks, tables, figures, captions, keyboard-visible focus, and non-color status labels.
- Preserve the template’s `data-*` contract and stable element IDs so annotation tools can anchor feedback.
- Remove the unused approval/selection branch and every `{{PLACEHOLDER}}`.
- Keep the artifact useful at 390 px and 1440 px widths.

### 8. Validate and inspect

Run:

```bash
# <skill-base-dir> = the "Base directory for this skill" shown when this skill loads
python3 "<skill-base-dir>/scripts/validate.py" "<output.html>"
```

Fix every error. Then open the HTML in an available browser or screenshot tool and inspect both narrow and wide layouts. Verify:

- the causal order is immediately visible
- the three target-model diagrams are readable
- exceptions are not visually buried
- approval and selection controls match the declared mode
- each option’s future state and next action are explicit
- raw evidence remains reachable

If the browser is unavailable, report that visual inspection was not run; do not claim it passed.

## Completion response

Return:

- absolute output path
- decision mode and source revision
- validator result and whether visual inspection ran
- failures, unverified items, and omitted scope that remain
- one sentence describing exactly what decision the reviewer can now make

Do not claim the HTML itself records formal approval unless it is integrated with the actual approval system.
