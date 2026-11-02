# Scenario Optimizer — implementation baseline (SPEC-OPT-001)

Status: discovery / design on isolated feature branch; no production changes.
Source: Verzuolo BC-341357, reference reports v4 (10/10/10), v5 (12/12/12), v7 (15/15/15), v8 (10/15/15).

## Existing code reuse
- src/calculations.js is the authoritative business-case facade; internally calls calculationsBase, warranty-independent VAT conversion, hybrid adjustments and publishLiveBusinessCaseResult.
- src/financingAdvisor.js computes financing scenarios, but currently varies financing duration alone and uses a stored service horizon; its advisory logic intentionally clears manual all-inclusive canone in a *calculation copy*.
- src/customerValuePhases.js and src/servicePeriodsRuntime.js contain phase and service-duration rules.
- src/financingAdvisorPeriods.js manages explicit Apply/Restore and MUST NOT be called by the read-only optimizer.
- src/liveBusinessCaseResult.js publishes browser events and updates window-level stores. A **strictly read-only** optimizer must not cause these side effects; introduce a pure calculation adapter (or suppress publication explicitly) before integrating it.
- Existing regression: src/financingAdvisor.test.js, test/calculations.test.js, test/proposalCashFlowReconciliation.test.js, test/servicePeriods.test.js, docs/VIMALUX_SAFE_RELEASE.md.

## Required model
- Unchanged source snapshot with source revision, deep copied and never persisted.
- Financing range 5..15 years; CMS and Adaptive term independently up to 15 years.
- Adaptive requires CMS for the entire adaptive term unless validated alternative provisioning.
- Common 15-year horizon; assumptions for service expiry and continuation of savings MUST be explicit; no invented benefit after service expiry.
- Per-year gross benefit, CMS fee, Adaptive fee, financial installments, maintenance, replacement and risk allowances, net cash flow.
- Comparable 15y NPV; contract NPV separately.
- First-year benefit, minimum annual net benefit, max cashflow deficit, total financing cost, service term, warranty gap, stress-case scores.
- Hard invalidation if assumptions unavailable; constraint-first ranking.

## Verzuolo golden reference
CAPEX 235316 EUR; service fees 7304 EUR/year; 2% annual energy price escalation; 5% discount rate.
| Finance/CMS/Adaptive | Year-1 net benefit | Reported NPV (its own horizon) |
|---|---:|---:|
| 10/10/10 | 10783 | 109160 |
| 12/12/12 | 14477 | 164454 |
| 15/15/15 | 18057 | 240837 |
| 10/15/15 | 10783 | 256389 |
Reports use different analysis horizons, so NPV figures above are **regression references only** and must not be compared as the optimizer's common-15y ranking.

## Phase 1 acceptance gates
1. Golden results within existing rounding tolerances, no change in saved business cases.
2. Show no finance charge in years 11-15 for 10/15/15 while services continue.
3. No localStorage, Supabase, CRM, Planner writes; no published business-case browser event.
4. Core test suite and build pass; new optimizer tests assert source object byte-equivalent.
5. Source revision mismatch prevents applying selected scenario.
6. Feature flag OFF by default; no active production code path until validation.

## Release discipline
Work only on this non-main feature branch. Staging-only preview after automated tests.
Do not alter production DB or main; verify staging DB connection before any deployment.
Document rollback via feature flag and retain previous production deployment.
