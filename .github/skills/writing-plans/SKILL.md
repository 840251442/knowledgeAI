| name | writing-plans |
| --- | --- |
| description | Use after design is confirmed to generate a step-by-step implementation plan with TDD tasks, file paths, and commit checkpoints. |

# Writing Plans（生成实现计划）

Generate a detailed, TDD-based implementation plan before writing any code.

Core principle: Every step is an action (2-5 min). No placeholders. No TODOs.

## When to Use

- After `brainstorming` skill confirms the design
- When a feature requires multiple files or components
- Before any non-trivial implementation

## Step 1: Scope Check

If the task spans multiple independent subsystems, ask:
**"Split into multiple independent plans? Each plan should produce independently testable software."**

## Step 2: File Structure Planning

Before creating tasks, list all files to be created or modified:

- One clear responsibility per file
- Files that change together go in the same task
- Prefer small, focused files over large all-in-ones
- Follow existing patterns in the codebase

## Step 3: Generate the Plan Document

Save to: `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

### Required Header

```markdown
# [Feature Name] Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** one sentence describing what to build

**Architecture:** 2-3 sentences describing the technical approach

**Tech Stack:** key dependencies/libraries

---
```

### Task Granularity Requirements

**Each step is one action (2-5 minutes):**
- "Write a failing test" → one step
- "Run test to confirm it fails" → one step
- "Write minimal implementation to pass test" → one step
- "Run test to confirm it passes" → one step
- "Commit" → one step

### Task Structure Template

````markdown
### Task N: [Component/Feature Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('should do X', () => {
  const result = myFunction(input);
  expect(result).toBe(expected);
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm test path/to/test.ts`
Expected: FAIL — "myFunction is not defined"

- [ ] **Step 3: Write minimal implementation**

```typescript
export function myFunction(input: string): string {
  return expected;
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `pnpm test path/to/test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat: add myFunction"
```
````

## Banned Content (Plan Fails If Present)

- "TBD", "TODO", "implement later"
- "Add appropriate error handling" (write the actual code)
- "Write tests for the above" (no actual test code)
- "Similar to Task N" (must repeat actual code — readers may read out of order)
- Code steps without code blocks
- References to types/functions not defined in this plan

## Core Principles

- **DRY**: Identify repeated logic, don't implement twice
- **YAGNI**: Don't build "might need later" features
- **TDD**: Test first, implement second
- **Frequent commits**: Commit after each small step

## Self-Check Checklist

After writing the plan:
1. **Coverage check**: Does every requirement map to at least one Task?
2. **Placeholder scan**: Search for banned words above — fix any found.
3. **Type consistency**: Does Task 7 call functions defined consistently with Task 3?

## Completion

Output: **"Plan saved to `docs/superpowers/plans/<filename>.md`.**

**Two execution modes:**
1. **Task-by-task** (recommended) — execute one Task at a time, two-phase review after each
2. **Batch** — execute in batches with manual checkpoints

**Which do you prefer?"**
