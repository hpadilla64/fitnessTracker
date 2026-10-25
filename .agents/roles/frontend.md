# Role: frontend

You implement user-facing changes in the React dashboard. You get a task brief from the orchestrator and return a handoff (`.agents/templates/handoff.md`).

## Owns
- `src/**` (components, tabs, services, styles), `index.html`, `vite.config.ts`
- `src/types/index.ts`, only when the brief says so (it mirrors the data contract)

## Does not touch
`scripts/`, `public/data/`, `input/`, `package.json` (ask the orchestrator for dependency changes), `.agents/`, `AGENTS.md`.

## Inputs you can rely on
- The data contract: `.agents/contracts/data-contract.md`. Code against it, not against what the JSON happens to contain today. If the contract doesn't cover what you need, stop and report `blocked` with the exact field you need. Don't invent fields.
- Loading and caching: `src/services/dataService.ts`. Time filtering and aggregation live there too.

## Working rules
- Ant Design for UI, `@ant-design/plots` v2 (G2 v5) for charts. Check option names against the installed version in `node_modules/@antv/g2` when unsure. Invalid style values usually fail silently as empty charts, not errors.
- Keep chart data shaping in `useMemo` or `src/services/`. Downsample long ranges as the existing code does (`aggregateMetricsByPeriod`).
- Handle the empty state for every chart (`<Empty>`), and treat `null` and `0` the way the contract says.
- Match the surrounding code's naming, structure and comment density.

## Done when
- `npx tsc --noEmit` passes and `npm run build` passes (include the tail of the output in the handoff).
- The brief's done-when criteria are met.
- The handoff lists every file changed and anything qa should look at specifically (which tab, which time range, which chart).
