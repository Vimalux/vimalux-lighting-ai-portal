# VIMALUX SAFE RELEASE — IVA cash flow and proposal generation

Date: 2026-09-18  
Target: staging only  
Production: unchanged until explicit approval

Follow-up staging commit: `8cc9eec8ffc6ee4fc5680d852ae1c633a9f56b28` (2026-09-20)

## Root cause

The economic engine kept VIMALUX commercial values correctly net of VAT, and the VAT card calculated non-recoverable VAT separately. The customer-facing annual benefit, NPV, cash-flow table and PDF, however, still consumed the net calculation fields. A municipality therefore saw a gross monthly payment in the VAT card while annual benefit and NPV remained net-of-VAT.

The Feletto report error had a separate cause. `Genera PDF` used the active Business Case after its stored catalogue had been hydrated with the current master catalogue and any selected historical products. `Genera Proposta Preliminare` reloaded `intelligence_data` directly from `list_business_cases` and ran the quality gate before that hydration. Product IDs that were valid in the active project could consequently be reported as unknown. Role-specific loading and cached/saved project versions made the discrepancy visible to an agent, but the access-control rule was not the defect.

The unexplained Feletto CAPEX line of EUR 5,012 was not a manual LaaS payment override. It was selected Adaptive Dimming partner equipment already included in total CAPEX but omitted from the customer CAPEX detail: two camera sensors (EUR 1,000), two LTE modem units (EUR 4,000) and implementation (EUR 12). The report reconciler therefore displayed the missing detail as a generic commercial adjustment.

The page-4 and page-5 benefit discrepancy came from the final visual report consuming net contract-payment rows even after the municipality VAT layer had calculated gross customer payments. For Feletto this meant EUR 31,200 was deducted instead of EUR 38,064, overstating annual net benefit by EUR 6,864.

## Changes

- Added a customer VAT cash-flow layer without changing VIMALUX net prices, revenue, margin or financing calculations.
- Added VAT-aware annual gross benefit, gross customer payment, annual net cash flow, cumulative cash flow and customer NPV.
- Energy and maintenance savings remain on the Business Case's net-of-VAT basis. Only non-recoverable VAT on the customer's new payments reduces customer cash flow.
- Kept explicit net and gross customer payment fields so LaaS/finance reports do not mix bases.
- Updated CRM Business Case snapshots and customer PDFs to use customer cash-flow benefit/NPV while retaining net-of-VAT audit fields.
- Hydrated the Preliminary Proposal project with the master catalogue plus selected historical products before technical quality validation.
- Kept genuine missing/unknown product assignments as blockers and compatibility mismatches as warnings.
- Bound the final visual cost chart and annual cash-flow table to the same municipality gross-payment rows as Analisi Economica.
- Added both net and gross annual LaaS/Noleggio payment to the benefit bridge and prints the explicit annual-benefit formula.
- Itemized selected partner equipment in the CAPEX table; a genuine remaining reconciliation difference is now identified as a difference, with its formula, and never presented as a standalone cost.
- Clarified that census/geolocation, UNI 11248 classification, sizing and optics are post-award activities or require a separate assignment, and that their cost is outside CAPEX unless explicitly listed.
- Verified support for a project-specific 12-year extended warranty without changing the global warranty default or the stored Feletto project before acceptance.

## Regression evidence

- Platform consistency guard: passed.
- Focused IVA, Feletto catalogue hydration and proposal quality tests: 12/12 passed.
- Full automated suite: 369/369 passed on follow-up commit `8cc9eec`.
- Production build: passed (Vite, 577 modules).
- Existing agent pricing restrictions, CRM identity, project persistence, partner roles, LaaS logic, procurement PDFs and report quality gates remain covered by the full suite.
- Both Vercel preview projects built the exact follow-up commit and reached `READY`; the protected preview itself loads successfully.
- Exact Feletto live-role PDF acceptance remains pending because the isolated staging database does not contain production Business Case `c5bfff10-01b6-4ce2-b147-b598df111c38`.

## Required staging acceptance before production

1. Open the same Feletto v/a4 Business Case as Luciano and as an assigned agent.
2. Confirm both roles resolve the same Business Case ID and proposal version.
3. Generate `Genera PDF` and `Genera Proposta Preliminare` for both roles.
4. Confirm the proposal quality gate no longer reports the 12 known A4 assignments; intentionally remove one product and confirm the gate still blocks it.
5. Test municipality at 0% VAT recovery and ESCO at 100% recovery.
6. Verify net canone remains unchanged, gross canone adds only non-recoverable VAT, annual net benefit and NPV follow the same cash-flow basis, and the PDF matches the screen.
7. Confirm no production network requests from the staging preview.

## Rollback

Rollback remains the immutable production parent `8cba085`. Revert staging commit `8cc9eec` or redeploy `8cba085`. No database migration or stored-project rewrite is included.
