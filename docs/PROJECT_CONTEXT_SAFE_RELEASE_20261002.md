# San Fele / Feletto project context — staging only

Base: fa99d12ef83e3c39f63b0177dad99fcd58cd6130.

Creating/selecting a Business Case now changes its ID, saved menu and URL together.
React renders the project header; legacy DOM context writers stand down on the managed app.
Late project requests are invalidated by explicit selection. Account hydration uses
the current account cache, preserves edits made during the request, and is not repeated
for token refresh. An unresolved ID never silently edits the first project.
Local-to-cloud promotion retains the menu and legacy ID for browser history.
Solar results update the matching React project instead of reloading the page.

No calculations, prices, CRM financial mapping, database schemas or permissions changed.
Legacy report storage projections and unmanaged-runtime compatibility remain available.
The initial cache migration retains existing local drafts; subsequent caches are account scoped.

## Validation

- Full unit/regression suite: 431 tests, all passing locally.
- Platform consistency validation and Vite build pass.
- Real React browser integration uses an intercepted Supabase module with the production
  auth branch enabled. All external HTTP is blocked; no production data is used.
- Covers San Fele creation and 22-luminaire edit vs Feletto's 11, Existing Lighting,
  token refresh, reload, back/forward, two tabs, project return, delayed Feletto response,
  cloud-ID promotion, critical workflow screens and agent access restrictions.
- Run the browser test against local Vite using
  `node scripts/verify-project-context.mjs`. Playwright must be available, or set
  `VIMALUX_PLAYWRIGHT_MODULE` to its module URL. Optional test origin/output variables
  are documented by the script. This adapter is test-only and never bundled into the app.
- Remote CI and immutable Preview validation must pass before this is considered staging-ready.

## Release boundary and rollback

Only publish to a staging branch. Do not merge or promote to production in this task.
Production baseline recorded before work:
`dpl_EUnJzMAiZY7W4gGUG41kNh8xfA2J`, commit `fa99d12ef83e3c39f63b0177dad99fcd58cd6130`,
READY and marked as a rollback candidate by Vercel.
Previous production `dpl_Amt5Ld3cjdeSh7kLRtgVSC2pkqnF` is also a READY rollback candidate.
Neither deployment is modified or removed.

For rollback of this staging change, use the base commit on staging; no database rollback
or data deletion is required. Before any later production promotion, retain the live
deployment and compare golden Business Case outputs under the standard SAFE RELEASE gate.
