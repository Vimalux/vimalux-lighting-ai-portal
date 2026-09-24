# VIMALUX SAFE RELEASE — Internal profitability and partner OPEX

## Scope

This release improves internal profitability transparency without changing the underlying commercial formulas, pricing inputs, permissions, Supabase schema, or production data.

## Internal Report

The internal report separates:

- CAPEX / hardware sales, direct cost, VIMALUX margin and margin %;
- total recurring OPEX excluding Adaptive Dimming;
- CMS / DATEK annual customer sales, supplier cost, VIMALUX margin and contract-period margin;
- gateway / connectivity economics;
- other recurring OPEX;
- Adaptive Dimming / Felicity customer fee, supplier share, VIMALUX annual margin and contract-period margin;
- total VIMALUX project contribution after all direct project costs, before corporate overhead and tax.

The existing minimum margin parameter keeps its original meaning: minimum total project margin.

## Presentation safeguards

- Total recurring OPEX is explicitly labelled as excluding Adaptive Dimming, so DATEK detail is not mistaken for a second cost layer.
- Adaptive Dimming customer sales, supplier cost and VIMALUX annual margin are shown with one decimal to avoid visible rounding mismatches.
- Existing legacy partner-report ARR / contract-value aliases are preserved to avoid downstream regressions.

## Default override safeguard

Project-specific commercial overrides must never silently become defaults for a new Business Case. On app initialization the stored default profile is sanitized so these fields are removed if they are present:

- `allInclusiveAnnualPayment`
- `officialOfferCapex`
- `officialAnnualOpex`

Legitimate defaults such as energy price, operating hours, financing period and minimum project margin are preserved.

## Regression coverage

Automated coverage checks:

- hardware, recurring OPEX, CMS, gateway, Adaptive Dimming and total project contribution separation;
- DATEK / Felicity customer-vs-supplier economics;
- legacy partner-report semantics;
- recurring-OPEX presentation label;
- Adaptive Dimming precision presentation;
- removal of hidden project-specific overrides from both nested and legacy-flat default storage while preserving legitimate defaults.
