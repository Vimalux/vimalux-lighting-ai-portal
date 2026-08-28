# VIMALUX data flow — CRM RC1

## Product roles

```text
VML Agent Input Sheet / Existing CRM Import
                    ↓
           VIMALUX CRM opportunity
                    ↓
     VIMALUX Intelligence calculation engine
                    ↓
       Authoritative Business Case snapshot
                    ↓
             CRM pipeline and reporting
                    ↓ GO + calculated case
             VIMALUX Planner handoff
```

CRM is the master for customer, contact, source, opportunity, pipeline and the stored Business Case result. VIMALUX Intelligence remains the only calculation engine for ROI, NPV, lifecycle, CLO, PowerAiD and finance. CRM calculates only probability-weighted TCV and ARR.

The current application stores each opportunity as an `intelligence_projects.data` JSON document. RC1 extends that document migrationsafely rather than replacing the production table. Existing projects therefore receive defaults when loaded and remain readable.

## Identity and merge rules

1. `unique_project_id` / `opportunity_id` is the idempotency key.
2. A repeated ID updates the existing opportunity.
3. A new ID creates a new opportunity.
4. If the municipality already exists, its customer/contact identity is reused; non-empty imported contact values may safely supplement it.
5. Legacy files without a unique ID retain their existing Business Case/quotation and legacy matching path.

### CRM ↔ Intelligence ownership boundary

- `projects.id` is the CRM Opportunity ID; `business_cases.id` is the Intelligence Business Case record ID.
- `business_cases.crm_opportunity_id` is the authoritative, unique relationship. Names and municipality text are never link keys.
- CRM creates or reopens a Business Case through the idempotent `create_or_get_business_case` RPC. Repeated calls return the existing record.
- Intelligence creates a CRM Opportunity only for a genuinely new, unlinked Intelligence project. Later saves update the linked Opportunity.
- Intelligence owns technical groups, calculations, CAPEX/OPEX/TCV, savings, recommendations and technical assumptions.
- CRM owns pipeline stage, probability, assignment, comments, manual notes, CMS Partner selection where CRM-maintained, and offer/history records.
- Intelligence synchronization updates only calculated CRM columns and its namespaced Business Case snapshot. It does not delete or replace comments, proposal snapshots, assignment, pipeline state or unrelated CRM metadata.
- Missing/null Intelligence values do not clear populated CRM-owned values.

## Periods

The following fields remain independent throughout import, CRM and Business Case:

- `financing_period_years`: repayment/financing only.
- `service_agreement_period_years`: CMS, monitoring, PowerAiD and other contracted services.
- `analysis_period_years`: NPV, lifecycle, cash flow and CO₂ analysis.

They must never be collapsed into one generic contract period.

## Agent Input Sheet mapping

| Agent Excel field | Canonical CRM field | Business Case field | Planner handoff field |
|---|---|---|---|
| `customer_id` | `customer.customerId` | reference only | `customer_id` |
| `municipality_name` | `customer.municipalityName` | `customer.name` | municipality |
| `province` | `customer.province` | `customer.province` | province |
| `region` | `customer.region` | `customer.region` | region |
| `country` | `customer.country` | `customer.country` | country |
| `contact_id` | `contact.contactId` | reference only | `contact_id` |
| `contact_name` | `contact.name` | `customer.contact` | contact |
| `contact_title` | `contact.title` | `customer.title` | contact title |
| `contact_email` | `contact.email` | `customer.email` | contact email |
| `contact_phone` | `contact.phone` | `customer.telephone` | contact phone |
| `agent_id` | `source.agentId` | reference only | source reference |
| `agent_name` | `source.agentName` | `project.consultant` | consultant |
| `source` | `source.source` | reference only | source |
| `opportunity_id` / `unique_project_id` | `opportunity.uniqueProjectId` | stable URL reference | `opportunity_id` |
| `project_name` | `opportunity.projectName` | `project.name` | project name |
| `business_case_id` | `opportunity.businessCaseId` | `project.businessCaseId` | `business_case_id` |
| `stage` | `opportunity.stage` | — | stage/reference |
| `probability_pct` | `opportunity.probabilityPct` | — | — |
| `expected_close_date` | `opportunity.expectedCloseDate` | — | — |
| `go_status` | `opportunity.goStatus` | authoritative result status | approval status |
| `notes` | `opportunity.notes` | — | notes |
| `total_luminaires` | `assumptions.totalLuminaires` | aggregate group quantity | preliminary quantity |
| `existing_technology` | `assumptions.existingTechnology` | existing group technology | preliminary technology |
| `average_existing_watt` | `assumptions.averageExistingWatt` | existing group wattage | preliminary wattage |
| `annual_operating_hours` | `assumptions.annualOperatingHours` | `assumptions.operatingHours` | annual hours |
| `energy_price` | `assumptions.energyPrice` | `assumptions.energyPrice` | preliminary energy price |
| `existing_dimming_profile` | `assumptions.existingDimmingProfile` | group dimming profile | preliminary dimming profile |
| `existing_dimming_pct` | `assumptions.existingDimmingPct` | group dimming percentage | preliminary dimming percentage |
| `existing_driver_type` | `assumptions.existingDriverType` | group driver type | preliminary driver type |
| `smart_lighting_enabled` | `assumptions.smartLightingEnabled` | `solution.smartEnabled` | selected concept |
| `cms_enabled` | `assumptions.cmsEnabled` | `solution.cmsEnabled` | selected concept |
| `poweraid_enabled` | `assumptions.powerAidEnabled` | `solution.powerAidEnabled` | selected concept |
| `financing_model` | `commercial.financingModel` | `assumptions.dealType` | commercial model |
| `financing_period_years` | `commercial.financingPeriodYears` | `assumptions.financingPeriod` | financing period |
| `service_agreement_period_years` | `commercial.serviceAgreementPeriodYears` | `assumptions.serviceAgreementPeriod` | service period |
| `analysis_period_years` | `commercial.analysisPeriodYears` | `assumptions.analysisPeriod` | analysis period |

Both a normal header row with one opportunity per row and a `Field` / `Value` layout are accepted.

## Existing CRM Import mapping

The existing `CRM_IMPORT` workbook and its validation against `Dashboard` / customer-offer sheets remain supported. Its values are first parsed with the existing importer and then mapped into the same canonical opportunity structure:

| Legacy field | Canonical destination |
|---|---|
| `project_name` | opportunity project name |
| `customer_name` | municipality/customer |
| `quotation_id` | Business Case ID and fallback opportunity reference |
| `lamps` | total luminaires |
| `capex` | authoritative imported CAPEX override |
| `contract_years` | service agreement period |
| `financing_years` | financing period |
| validated customer payment | all-inclusive annual payment |
| `total_opex_annual` | authoritative imported annual OPEX override |

## Authoritative Business Case snapshot

`src/businessCaseSync.js` is the integration boundary. It invokes the existing central calculation engine once and stores a versioned snapshot under `crm.businessCase`. CRM reads these values and does not reproduce the formulas.

Stored result fields include CAPEX, OPEX, customer payment, TCV, ARR/MRR, net benefit, payback, NPV, lifecycle result, energy/CO₂ reductions, Smart nodes, DATEK values and PowerAiD fee/cost/margin.

Stable links use `opportunity_id`, `customer_id` and `business_case_id`. When the app opens such a link, it selects the matching opportunity. Planner handoff is enabled only when a calculated Business Case exists and status is `GO`; it transfers aggregate assumptions and never invents GPS, census, road class or photometric data.

## Import audit

For RC1, import history is stored inside each affected opportunity JSON document. It records file, source format, template version, user, timestamp and created/updated/skipped/error counts. This avoids a destructive production database migration while retaining audit data in Supabase.
