# Repository rules for agents

1. Treat `kpf.md` as the source of truth for key product functionality.
2. For every changed or new KPF, update `kpf.md` and add or update an automated
   test in `test/` in the same change.
3. Before every commit, run `npm test`. Do not commit if any KPF test fails.
4. Keep all game rules in `game-core.js` (DOM-free, unit-tested). `app.js`
   handles only rendering and input.
5. Before handing off a user-facing change, verify the relevant KPF in the
   running app.
6. Keep product rules simple, user-visible, and independently testable.
