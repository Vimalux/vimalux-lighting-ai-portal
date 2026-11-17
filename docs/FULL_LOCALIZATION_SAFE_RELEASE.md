# VIMALUX SAFE RELEASE - complete language coverage

## Product rule

The selected UI language must cover every user-facing string in Intelligence and
CRM. Translating only navigation is insufficient. Until this acceptance contract
passes, the Spanish selection must not be shipped to production.

Supported selections: Italian (`it`), English (`en`), Danish (`da`), Spanish
(`es`). Domain data (company names, product IDs, municipality names, notes,
user-entered descriptions and uploaded files) is never machine-translated.

## In scope

1. Shared navigation, project selection, authentication, data-saving notices,
   validation errors, empty states and confirmation dialogs.
2. Every Intelligence workflow field, button, tooltip, explanation, table,
   financial label and chart: Customer, Existing Lighting, Solution, Additional
   Costs, Pricing, Assumptions, Economic Analysis and Report.
3. CRM Opportunities, pipeline, import wizard, archive reasons, activity,
   actions and links to Intelligence/Planner.
4. Catalogue, procurement/order list, partner dashboards/reports, price admin,
   internal project profitability and commercial approval.
5. All generated customer PDFs, preliminary proposals, internal PDFs, partner
   reports and supplier/order documents; fonts must correctly render Spanish
   accents and special characters, including in small tables.
6. Dates, numbers, percentages and currency formatting appropriate to the
   display language. Project currency and all price, VAT, financing and energy
   assumptions remain project data: changing the language cannot change them.

## Release gates

### Current staging status — 17 November 2026

**Not approved for production.** The VAT/cash-flow, existing dimming and price
administration panels have now received explicit IT/EN/DA/ES copy and translation
coverage checks. The separate `vimalux-crm` application and the remaining
Intelligence/PDF modules still require full inspection and localization. A green
build confirms regression coverage only, not complete language coverage.

The Intelligence Solution workflow (warranty, Smart/CMS/Adaptive selection,
LCU controls, partner equipment and cost summary) also has complete
IT/EN/DA/ES source-copy coverage and dedicated automated tests. Production
remains unchanged while the rest of the platform is localized.

Bolivia-specific energy tariff and VAT assumptions are **not** automatically
changed by the interface language: verify the local tariff, applicable taxes and
currency before sending a proposal.

- No untranslated English/Italian labels when Spanish is selected, and likewise
  for each other supported language. Explicitly approved loanwords, trademarks,
  technical abbreviations and product names are allowed.
- No unreviewed automatic translation of legal/financial offer conditions.
- Project save/load, user roles, customer reports, CRM links, commercial GO and
  approval permissions produce the same values before and after language changes.
- Changing the language does not duplicate a Business Case or reset financial
  assumptions; the selected language persists when the project is reopened.
- Visual test on desktop and narrow screens for every workflow and CRM page.
- PDF generation and rendered-page review for all supported document families,
  in each of the four languages, with financial totals reconciled to the source.
- Existing tests, full production build, and staging end-to-end smoke tests pass.
- A known-good production deployment remains available for rollback. Never
  promote the branch before an explicit Admin approval of the tested build.

## Implementation guidance

Place all copy behind shared message keys with per-language dictionaries and
variable interpolation. Avoid fragile DOM text replacement. Maintain a coverage
test that checks missing keys for each language. Report-generation modules must
use the same locale contract, but keep distinct customer-facing and internal
translations. Review translated business/legal wording before release.
