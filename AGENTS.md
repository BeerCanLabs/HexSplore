# BeerCanLabs — Agent & Contributor Engineering Standard

This document is the single source of truth for repository engineering, testing maturity, and architectural acceptable-use rules across the **BeerCanLabs** organization. Every human contributor, autonomous AI agent (Switch, Archie, Donna, Higgins, Geordi, etc.), and code assistant MUST adhere to these non-negotiable standards.

---

## 1. Key Product Flows (`KPF.md`) — Mandatory Synchronization

`KPF.md` at the repository root is the canonical specification of user-facing capabilities and system behaviors.

- **The Non-Negotiable Rule:** Any commit, PR, or task that adds, modifies, or removes **user-facing behavior** MUST land in the same commit/PR with an update to `KPF.md`.
- **Structure per KPF Entry:**
  Every numbered entry (e.g. `## 1. Feature Name`) must contain all four required sections:
  1. **Description:** Plain-language summary of what the user or calling system experiences.
  2. **Entry points:** Specific source files, functions, routes, DOM elements, or CLI commands.
  3. **If it silently breaks:** Concrete impact on the end user or system if this flow fails without a crash.
  4. **Test status:** Explicit automated test suite/file path asserting this flow (e.g., `Automated (tests/test_feature.py::test_user_flow)`).
- **Honest Alignment:** The `Test status` in `KPF.md` must match the actual automated tests in `tests/` 100%. Never claim test coverage that does not exist.
- **Retirements:** When functionality is removed, mark the entry **Retired with date**—never delete historical KPF numbers.

---

## 2. Architecture & Acceptable Use (`.draft/sdp.yaml`)

`.draft/sdp.yaml` at the repository root is the authoritative DRAFT Software Deployment Pattern manifest declaring components, substrates, and dependencies.

- **Acceptable Use Decision Tree:**
  - **Tier 1 (Stateless / Client-Only):** GitHub Pages is approved for static browser frontends without server-side persistence.
  - **Tier 2 (Stateful / Database / APIs / Serverless):** You MUST consult **Draft** to select approved technologies and substrates (e.g. Cloud Run, Firestore, SQLite + Litestream on Cloud Storage, Cloud SQL). Never introduce unapproved hosting, external database vendors, or unvetted substrates.
- **Architecture Updates:** Any change that introduces a new component, data store, runtime service, or substrate MUST update `.draft/sdp.yaml` in the same PR.

---

## 3. Automated Testing & Verification

- Every repository maintains automated test suites in `tests/`.
- All tests must pass locally and in CI before opening or merging a Pull Request.
- Never delete, skip, or comment out failing tests to achieve a passing build.

---

## 4. Zero Secrets & Security Hygiene

- **Never commit plaintext credentials:** API keys, tokens, passwords, and service account keys must NEVER be committed to Git.
- All secrets must be fetched dynamically at runtime via environment variables mapped from GCP Secret Manager.

---

## 5. Branching & GitHub Flow

- Work on short-lived feature branches off `main`.
- Open a Pull Request referencing the updated `KPF.md` entries and test results.
- Self-merging without automated test validation is prohibited.
