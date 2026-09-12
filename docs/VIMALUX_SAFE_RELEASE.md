# VIMALUX SAFE RELEASE

This repository uses a fail-closed release process for VIMALUX Intelligence / CRM.

## Mandatory release gate

No functional change goes directly to production unless it is an explicitly approved emergency rollback/fix.

Before production:

1. Work on a non-production branch.
2. Preserve all existing features, permissions and data semantics unless the change request explicitly says otherwise.
3. Run the full automated test suite and build.
4. Add regression coverage for the changed flow.
5. Validate the Vercel Preview deployment.
6. Validate critical user flows with a known Business Case.
7. Confirm calculation outputs have not changed unless the release intentionally changes calculation logic.
8. Keep the previous production deployment available as rollback candidate.
9. Merge/deploy to production only after validation.

## Critical regression contract

Every release affecting Intelligence, CRM, catalogue, procurement, imports or calculations must preserve:

- Agent cannot delete projects from Intelligence.
- Projects are archived through CRM according to role permissions.
- One CRM Opportunity maps to one stable Business Case.
- Re-import does not create duplicate active Business Cases.
- Active project/menu context survives reload and browser return.
- Project identity shown in the header matches the project being edited.
- Existing Lighting, Solution, Additional Costs, Assumptions, Analysis and Report retain their saved data.
- Price Administration remains VIMALUX/admin-only.
- Supplier Order List is generated from the selected catalogue products and is separated by supplier.
- Partner-facing order PDFs contain quantities/specifications but no internal prices.
- Calculation regression tests must pass before production.

## Smart/CMS procurement rule

Standard partner hardware must be maintained as Smart Catalogue products, not as generic Additional Costs.

Each purchasable Smart/CMS product should carry:

- stable Product ID
- brand
- supplier / procurement partner
- supplier SKU when available
- product type (LCU, Gateway, Antenna, Energy Meter, etc.)
- cost price
- customer sales price where applicable
- implementation cost/sales where applicable
- annual cost/sales where applicable
- active/inactive state

When a product is selected in Solution, `Lista ordini` must automatically create the corresponding supplier procurement line with the project quantity.

FELICITY follows the same rule: FELICITY hardware must exist as actual Smart Catalogue products before it is used in a commercial Business Case. Product names, SKUs and prices must not be invented or silently defaulted to zero.

## Golden calculation gate

Maintain known reference Business Cases and compare core outputs before releases that can touch calculations or project data:

- quantities
- LED CAPEX
- Smart CAPEX
- fixed annual OPEX
- CMS/service revenue
- customer annual/monthly payment
- energy saving
- maintenance saving
- total contract value

Unexpected differences block the release.
