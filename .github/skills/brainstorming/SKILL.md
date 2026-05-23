| name | brainstorming |
| --- | --- |
| description | Use before writing any code when there's no clear design doc. Refines requirements, explores alternatives, and produces a saved design document. |

# Brainstorming（方案设计 & 需求精炼）

Refine the design before writing any code. Use when the task lacks a clear design document.

Core principle: Ask first, don't jump to implementation.

## When to Use

- Before any non-trivial coding task
- When requirements are ambiguous
- When multiple solutions are possible
- When the user hasn't specified how, only what

## Step 1: Understand the Real Need

Don't jump to solutions. Clarify the goal first:

1. Describe the real problem in one sentence (not the solution).
2. What does success look like? How do you verify "done"?
3. Is there an existing solution? Why not use it?
4. Who are the users? How do they do this today?

Ask **1-2 questions at a time**, wait for answers before continuing.

## Step 2: Explore Alternatives

Before committing, present **2-3 directions**:

- **MVP** — simplest thing that works
- **Complete** — more robust but complex
- **Off-the-shelf** — borrow an existing library/tool

For each, state:
- Core idea (1-2 sentences)
- Key tradeoffs (what's good, what's bad)
- Best fit scenario

## Step 3: Present Design in Chunks

Don't dump a full spec at once. Break into small blocks, ask after each:
**"This part OK, or need adjustment?"**

Typical chunks:
1. Problem definition (is your understanding accurate?)
2. Technical approach (which option, why)
3. Data structures / API design
4. Edge cases (errors, concurrency, permissions)
5. Out of scope (explicit boundaries)

## Step 4: Save Design Document

After user confirms, save to:

```
docs/designs/YYYY-MM-DD-<feature-name>.md
```

Document structure:
```markdown
# [Feature Name] Design

**Problem:** one sentence
**Solution:** one sentence
**Out of scope:** explicit exclusions

## Technical Approach
...

## Interface / Data Structures
...

## Edge Cases
...

## Acceptance Criteria
- [ ] ...
```

## Core Principles

- **Socratic method**: Ask, don't tell.
- **YAGNI**: Don't build "might need later" features.
- **DRY**: Identify duplication at design time.
- **Simple first**: Don't introduce complex architecture for simple problems.

## Completion

Output: **"Design saved to `docs/designs/<filename>.md`. Next: use `writing-plans` skill to generate an implementation plan."**
