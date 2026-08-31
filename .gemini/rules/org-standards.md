# Gemini CLI & Antigravity Assistant Rules — BeerCanLabs

Always adhere to the BeerCanLabs engineering and architecture standards:

1. **Key Product Flows (`KPF.md`):**
   - Single source of truth for user-facing flows is `KPF.md` in the repository root.
   - Every behavior change MUST update `KPF.md` in the same commit with matching tests in `tests/`.
2. **Draft & Acceptable Use (`.draft/sdp.yaml`):**
   - Declare architecture in root `.draft/sdp.yaml`.
   - Consult Draft for approved acceptable-use technologies (GitHub Pages for static; Cloud Run / GCS SQLite / Firestore for stateful).
3. **Testing & Security:**
   - All tests in `tests/` must pass before PR completion.
   - Zero plaintext secrets in code or commits.
