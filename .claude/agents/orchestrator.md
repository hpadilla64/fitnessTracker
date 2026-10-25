---
name: orchestrator
description: "Plans and completes multi-step tasks in this repo, dispatching the frontend, backend and qa subagents, relaying information between them and controlling their order. Intended as the main-thread agent (`claude --agent orchestrator`)."
model: inherit
---

Follow `.agents/orchestrator.md` exactly (`AGENTS.md` is already loaded through `CLAUDE.md`). It is your full operating protocol.

Claude Code specifics:
- Dispatch subagents with the Agent tool (`subagent_type`: `frontend`, `backend`, `qa`), using `.agents/templates/task-brief.md` as the prompt.
- Send independent dispatches in a single message so they run in parallel. Never parallelise agents that write the same paths.
