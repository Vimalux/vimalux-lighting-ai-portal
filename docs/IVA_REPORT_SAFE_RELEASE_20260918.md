# VIMALUX SAFE RELEASE — IVA cash flow and proposal generation

Date: 2026-09-18  
Target: staging only  
Production: unchanged until explicit approval

## Root cause

The economic engine kept VIMALUX commercial values correctly net of VAT, and the VAT card calculated non-recoverable VAT separately. The customer-facing annual benefit, NPV, cash-flow table and PDF, however, still consumed the net calculation fields. A municipality therefore saw a gross monthly payment in the VAT card while annual benefit and NPV remained net-of-VAT.

The Feletto report error had a separate cause. `Genera PDF` used the active Business Case after its stored catalogue had been hydrated with the current master catalogue and any selected historical products. `Genera Proposta Preliminare` reloaded `intelligence_data` directly from `list_business_cases` and ran the quality gate before that hydration. Product IDs that were valid in the active project could consequently be reported as unknown. Role-specific loading and cached/saved project versions made the discrepancy visible to an agent, but the access-control rule was not the defect.

## Changes

- Added a customer VAT cash-flow layer without changing VIMALUX net prices, revenue, margin or financing calculations.
- Added VAT-aware annual gross benefit, gross customer payment, annual net cash flow, cumulative cash flow and customer NPV.
- Energy and maintenance savings remain on the Business Case's net-of-VAT basis. Only non-recoverable VAT on the customer's new payments reduces customer cash flow.
- Kept explicit net and gross customer payment fields so LaaS/finance reports do not mix bases.
- Updated CRM Business Case snapshots and customer PDFs to use customer cash-flow benefit/NPV while retaining net-of-VAT audit fields.
- Hydrated the Preliminary Proposal project with the master catalogue plus selected historical products before technical quality validation.
- Kept genuine missing/unknown product assignments as blockers and compatibility mismatches as warnings.

## Regression evidence

- Platform consistency guard: passed.
- Focused IVA, Feletto catalogue hydration and proposal quality tests: 12/12 passed.
- Full automated suite: 363/363 passed.
- Production build: passed (Vite, 577 modules).
- Existing agent pricing restrictions, CRM identity, project persistence, partner roles, LaaS logic, procurement PDFs and report quality gates remain covered by the full suite.

## Required staging acceptance before production

1. Open the same Feletto v/a4 Business Case as Luciano and as an assigned agent.
2. Confirm both roles resolve the same Business Case ID and proposal version.
3. Generate `Genera PDF` and `Genera Proposta Preliminare` for both roles.
4. Confirm the proposal quality gate no longer reports the 12 known A4 assignments; intentionally remove one product and confirm the gate still blocks it.
5. Test municipality at 0% VAT recovery and ESCO at 100% recovery.
6. Verify net canone remains unchanged, gross canone adds only non-recoverable VAT, annual net benefit and NPV follow the same cash-flow basis, and the PDF matches the screen.
7. Confirm no production network requests from the staging preview.

## Rollback

Rollback is the parent production commit recorded before this staging change. Revert the single staging commit or redeploy that immutable parent commit. No database migration or stored-project rewrite is included.
