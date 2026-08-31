# Claude Code Instructions — BeerCanLabs

All work in this repository is governed by the BeerCanLabs engineering standards.

## Mandatory Non-Negotiables (Full spec: [AGENTS.md](./AGENTS.md))

1. **Root `KPF.md` Synchronization:**
   - Any commit or PR that alters user-facing behavior MUST update `KPF.md` at the repository root in the same commit/PR.
   - All 4 sections (*Description*, *Entry points*, *If it silently breaks*, *Test status*) are required per flow.
2. **Root `.draft/sdp.yaml` & Acceptable Use:**
   - Architecture must be declared in `.draft/sdp.yaml`.
   - **Acceptable Use:** GitHub Pages for static apps only. For apps requiring state/databases/APIs, consult **Draft** to select approved technologies (e.g. Cloud Run, Firestore, SQLite+GCS).
3. **Automated Tests:**
   - Every KPF flow must have matching tests in `tests/`. All tests must pass before opening PRs.
4. **Zero Secrets:**
   - Never commit API keys, tokens, or credentials.

See [AGENTS.md](./AGENTS.md) for full policy specifications.
