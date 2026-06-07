# Implementer Subagent Prompt Template

Use this template when dispatching an implementer subagent.

```text
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name]
    ## Task Description
    [FULL TEXT of task from plan - paste it here, do not make subagent read file]
    ## Context
    [Scene-setting: where this fits, dependencies, architectural context]
    ## Before You Begin
    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Dependencies or assumptions
    - Anything unclear in the task description
    Ask them now. Raise any concerns before starting work.
    ## Your Job
    Once you are clear on requirements:
    1. Implement exactly what the task specifies
    2. Write tests if the task requires them
    3. Verify implementation works
    4. Commit your work
    5. Self-review
    6. Report back
    Work from: [directory]
    While you work, if you encounter something unexpected or unclear, ask questions.
    ## Code Organization
    - Follow the file structure defined in the plan
    - Each file should have one clear responsibility with a well-defined interface
    - If a file you are creating grows beyond the plan's intent, stop and report it as DONE_WITH_CONCERNS
    - If an existing file is already large or tangled, work carefully and note it as a concern
    - Follow established patterns in the codebase
    ## When You Are in Over Your Head
    It is always OK to stop and say "this is too hard for me."
    STOP and escalate when:
    - The task requires architectural decisions with multiple valid approaches
    - You need to understand code beyond what was provided and cannot find clarity
    - You feel uncertain about whether your approach is correct
    - The task involves restructuring existing code in ways the plan did not anticipate
    - You have been reading file after file without progress
    ## Before Reporting Back: Self-Review
    Review your work with fresh eyes:
    - Did I fully implement everything in the spec?
    - Did I miss any requirements?
    - Is this my best work?
    - Did I avoid overbuilding?
    - Did I follow existing patterns?
    - Do tests verify real behavior?
    ## Report Format
    - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented
    - What you tested and results
    - Files changed
    - Self-review findings
    - Any issues or concerns
```
