# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify the implementer built what was requested, nothing more and nothing less.

```text
Task tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.
    ## What Was Requested
    [FULL TEXT of task requirements]
    ## What Implementer Claims They Built
    [From implementer's report]
    ## CRITICAL: Do Not Trust the Report
    The implementer finished suspiciously quickly. Their report may be incomplete,
    inaccurate, or optimistic. You MUST verify everything independently.
    DO NOT:
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements
    DO:
    - Read the actual code they wrote
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they did not mention
    ## Your Job
    Read the implementation code and verify:
    - Missing requirements
    - Extra or unneeded work
    - Misunderstandings
    Report:
    - Spec compliant
    - Or issues found, with specific file references
```
