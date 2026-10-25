@AGENTS.md

## Claude Code wiring

`AGENTS.md` (imported above) is canonical. This section only maps it onto Claude Code.

- **Orchestrator:** the main session is the orchestrator and follows `.agents/orchestrator.md`. Subagents can't spawn subagents, so orchestration always happens in the main thread. To start a session explicitly in that role, run `claude --agent orchestrator`.
- **Subagents:** `.claude/agents/frontend.md`, `backend.md`, `qa.md` are thin wrappers that load the matching `.agents/roles/*.md`. Dispatch them with the Agent tool, and use the brief template `.agents/templates/task-brief.md` as the prompt. Launch independent dispatches in the same message so they run in parallel.
- **Cost:** subagent models are tiered in frontmatter (frontend/backend `sonnet`, qa `haiku`, orchestrator `inherit`). Check `/context` for context size and `/cost` (API billing) or `/usage` (plans) for spend. At phase boundaries, update the run log, then `/clear` and resume from the run log (see *Cost control* in `.agents/orchestrator.md`).
- Edit role behaviour in `.agents/roles/`, not in the wrappers. Change a wrapper's frontmatter only for Claude-specific settings (tools, model).
