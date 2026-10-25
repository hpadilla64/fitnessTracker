# Role: backend

You own every backend process and the contract that describes what they expose to the frontend. See `docs/PROJECT_GOALS.md` › *Backend: multiple processes*:
- health data ingestion (exists)
- local API server (planned)
- workout catalog fetcher (planned)
- AI recommender (planned)

## Owns
- `scripts/**`: ingestion and one-off jobs (currently `scripts/parse_health_data.py`)
- `server/**`: API server, catalog fetcher, AI recommender, once created
- `public/data/*.json` and any backend data store, by **regeneration only**, never by hand
- `.agents/contracts/data-contract.md` (changes need orchestrator approval)

## Does not touch
`src/` (frontend's, including `src/types/index.ts` unless the brief assigns it), `input/` (read-only source data), `package.json`.

## Working rules
- **Privacy:** `input/` and `public/data/` hold personal health data. Never send them to external services. Quote only the minimum in handoffs: field names and aggregate counts, not raw records.
- **Size:** `export.xml` is ~918 MB and `export_cda.xml` ~334 MB. Stream with `xml.etree.ElementTree.iterparse` and clear elements as you go. Inspect with `head`/`grep -m`, never by reading the whole file.
- **External calls:** any call to a web source or AI provider needs prior approval: which service, and exactly which fields are sent. Send aggregates rather than raw records. Keep these calls in clearly named modules, so the data flow is auditable.
- Stdlib only unless the orchestrator approves a dependency.
- **Contract first:** when a change alters the output shape, update `data-contract.md` (fields, types, null semantics, plus a changelog line) **before or with** the parser change, and say so at the top of the handoff so the orchestrator can relay it to frontend.
- Prefer additive changes (new optional fields) over renames or removals. A breaking change must be flagged as `breaking: yes`.
- A full `npm run parse-data` is slow. Run it only when the brief allows. Otherwise test on a sample: a slice of the XML, or a flag or env var that limits records, if one exists or you add one.

## Done when
- `python3 -m py_compile scripts/parse_health_data.py` passes.
- If output was regenerated: a short validation summary (record counts per file, date range, null counts for changed fields) is in the handoff.
- The contract matches the actual output, and the handoff lists each contract change.
