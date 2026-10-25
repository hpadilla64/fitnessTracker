# Task brief

<!-- The orchestrator fills this in and sends it as the subagent's prompt. The subagent sees nothing else, so be complete. -->

**Role:** frontend | backend | qa
**Run log:** .agents/runs/<YYYY-MM-DD>-<slug>.md (or "none")
**QA tier** (qa only): static | data | visual: <which tab / cards / time ranges>

## Goal
<one or two sentences: the outcome, not the steps>

## Context already established
<findings, file:line references, root causes, decisions already made, and relevant output from other subagents. Don't make the subagent rediscover these.>

## Scope
- **May edit:** <paths>
- **Must not edit:** <paths, especially ones another agent is editing in this wave>
- **Out of scope:** <tempting adjacent work to leave alone>

## Contract
<"unchanged", or the exact fields added/changed, copied from the approved contract>

## Done when
- [ ] <checkable criterion>
- [ ] <verification command(s) pass>

## Return
A handoff using `.agents/templates/handoff.md`.
