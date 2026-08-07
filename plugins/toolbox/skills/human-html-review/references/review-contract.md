# Review information contract

Use this contract to decide what belongs in a human-facing review. It is an information schema, not a demand to show every field with equal visual weight.

## 1. Review contract

| Field | Required content |
|---|---|
| `decision_mode` | `approval` or `selection` |
| `decision_question` | One concrete question answerable by the reviewer |
| `target` | Artifact, change, plan, architecture, or research result being reviewed |
| `source_revision` | Base/head SHA, artifact version, or explicit `unknown` |
| `purpose` | Why this work exists |
| `success_criteria` | Observable conditions for success |
| `constraints` | Time, compatibility, policy, security, data, or operational constraints |
| `scope` | Included and excluded areas |
| `unknowns` | Missing evidence or assumptions that could change the decision |

The review contract must fit in the first viewport. It may link to detail below.

## 2. Causal timeline

Include only decision-relevant events:

```text
trigger → goal/constraint → alternatives → adoption/open options
        → target model → verification → decision → resulting action
```

Each event should have a source link or one of these labels:

- `Observed`: primary artifact supports it.
- `Agent claim`: the producing agent reported it.
- `Inference`: derived from stated premises.
- `Unknown`: evidence is unavailable.

Do not present an agent transcript, tool-call list, or celebratory completion summary as a timeline.

## 3. Review target model

Explain the target only after the reader knows the adopted result or open options. Limit the model to the slice required for the decision and name the boundary.

### Structure model

Include:

- components and responsibilities
- dependencies and external boundaries
- entry points and ownership
- added, changed, removed, and unchanged-but-affected nodes
- source locations for important nodes

### Behavior model

Include:

- initiating actor or trigger
- main success path
- outputs and externally visible behavior
- side effects
- retries, timeout, cancellation, and failure paths when relevant
- before/after behavior or option-specific behavior

### Data model

Include:

- entities and relationships
- owner and system of record
- persistence and retention
- state transitions and invariants
- schema or migration effects
- sensitive data and trust boundaries when relevant

Use diagrams to externalize relationships, not to decorate the review. Every edge must have a defensible meaning. Use captions to state boundaries and uncertainty.

## 4. Evidence model

For each material claim, record:

| Field | Meaning |
|---|---|
| `claim` | The proposition a reviewer may rely on |
| `kind` | `observed`, `agent-claim`, or `inference` |
| `source` | Code, diff, schema, command, test, log, screenshot, or specification |
| `revision` | Revision against which the evidence is valid |
| `state` | `pass`, `fail`, `not-run`, `unknown`, `unverified`, or `stale` |
| `coverage` | What the evidence proves and does not prove |
| `risk` | Consequence if the claim is wrong |

Never merge these independent axes into one green badge:

- machine evidence: pass/fail/unknown/not-run
- reviewer exposure: unseen/seen
- human decision: accepted/changes-requested/deferred
- discussion: unresolved/resolved
- currency: current/stale

## 5. Decision modes

### Approval

Show:

- adopted result and why it was chosen
- success criteria met and unmet
- residual risks and unknowns
- blocking and non-blocking findings
- what `Approve` causes next
- what `Request changes` should target
- rollback or reversibility after approval

### Selection

For every option, show:

| Dimension | Question |
|---|---|
| Outcome | What state exists after choosing it? |
| User | What does the user experience? |
| Structure | Which components, dependencies, and owners change? |
| Behavior | What happens on success and failure? |
| Data | What is stored, migrated, or re-owned? |
| Cost | What implementation, operation, migration, and learning cost follows? |
| Risk | What can fail, and what remains unverified? |
| Reversibility | Can the decision be changed later, at what cost? |
| Next action | What will the agent and human do immediately after selection? |

Show the recommendation as a conditional conclusion. State which constraints or weights would reverse it.

## 6. Information hierarchy

Use this order:

1. decision contract
2. exception summary
3. causal timeline
4. adopted result or options
5. target structure, behavior, and data model
6. verification mapped to claims and model elements
7. human decision surface
8. resulting action or future state
9. raw evidence

Keep exceptions in the first viewport even though detailed evidence appears later.

## 7. Visual and accessibility rules

- Use one visual message per figure.
- Keep diagram labels short and exact.
- Do not encode status by color alone; pair color with text and shape.
- Keep reading order meaningful without CSS.
- Use native headings, lists, tables, `figure`, `figcaption`, `details`, and `summary`.
- Provide visible keyboard focus and adequate contrast.
- Avoid horizontal scrolling for prose at 390 px.
- Prefer inline SVG with `role="img"`, accessible names, and a text explanation below.
- Draw diagrams with the `diagram-design` skill (see SKILL.md § Dependencies); embed the SVG inline and skip its external font link.
- Keep raw evidence accessible in text even when a diagram summarizes it.

## 8. Trust boundaries

The review HTML is a derived view. It must not silently replace:

- Git revisions and raw diffs
- CI results
- required review or merge protection
- specifications and schemas
- audit records

Pin the view to a source revision. Mark it stale when the source changes. Never turn `pass`, `seen`, `approved`, `resolved`, and `current` into a single status.
