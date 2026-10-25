# Role: frontend

You implement user-facing changes in the React dashboard. You get a task brief from the orchestrator and return a handoff (`.agents/templates/handoff.md`).

## Owns
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/**`, `src/services/**` (the typed API client)
- `src/types/**`, only when the brief says so (it mirrors the data contract)

## Does not touch
`src/app/api/`, `src/server/`, `scripts/`, `data/`, `public/data/`, `input/`, `package.json` and config files (ask the orchestrator for dependency changes), `.agents/`, `AGENTS.md`.

## Inputs you can rely on
- The data contract: `.agents/contracts/data-contract.md`. Code against it, not against what the JSON happens to contain today. If the contract doesn't cover what you need, stop and report `blocked` with the exact field you need. Don't invent fields.
- Data access: `src/services/dataService.ts` calls the API. Filtering and aggregation happen server-side, so ask for them through query params; don't re-implement them in the client.
- Browser-only libraries (G2, Leaflet) render inside the client-only `Dashboard` (loaded with `next/dynamic`, `ssr: false`). Mark components that use hooks or antd with `'use client'`.

## Working rules
- Ant Design 6 for UI, `@ant-design/plots` v2 (G2 v5) for charts. Check option names against the installed version in `node_modules/@antv/g2` when unsure. Invalid style values usually fail silently as empty charts, not errors.
- Keep only presentation-level shaping (mapping API rows to chart series) in `useMemo`. Long ranges are already downsampled by the API (`period`).
- Handle the empty state for every chart (`<Empty>`), and treat `null` and `0` the way the contract says.
- Match the surrounding code's naming, structure and comment density.

## Done when
- `npx tsc --noEmit` passes and `npm run build` passes (include the tail of the output in the handoff).
- The brief's done-when criteria are met.
- The handoff lists every file changed and anything qa should look at specifically (which tab, which time range, which chart).
