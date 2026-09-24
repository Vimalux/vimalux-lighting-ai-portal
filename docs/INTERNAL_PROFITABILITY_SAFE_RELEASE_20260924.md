# VIMALUX SAFE RELEASE — Internal profitability and partner OPEX

Scope: reporting only. No calculation formulas, pricing inputs, permissions, Supabase schema or production data are changed.

## Internal report
- Keep the existing 30% threshold semantics as total project margin: net project profit / total contract revenue.
- Relabel the threshold to clarify that it is the minimum total project margin.
- Relabel net project profit as VIMALUX project contribution, explicitly before corporate overhead and tax.
- Show CAPEX/hardware sales, direct cost, margin and margin % separately.
- Show recurring OPEX sales, supplier/direct cost, annual margin, margin % and contract margin.
- Show CMS/DATEK annual customer sales, annual supplier cost, VIMALUX margin and contract margin.
- Show gateway/connectivity and other OPEX separately.
- Show Adaptive Dimming/Felicity customer fee, supplier share, VIMALUX margin and contract margin.

## Partner reports
- Add explicit customer sales, supplier cost, VIMALUX margin and margin % per year.
- Add customer contract value, supplier contract cost and VIMALUX contract margin.
- Preserve historic partner dashboard aliases to avoid changing existing partner-report semantics outside the new profitability views.

## Regression contract
- Existing partner reports retain their legacy ARR / total-contract-value values.
- New explicit profitability fields are additive and unambiguous.
- DATEK uses cmsRevenue for customer sales and cmsDirectCost for supplier cost.
- Adaptive Dimming uses powerAidCustomerFee for customer sales and powerAidSupplierCost for supplier cost.
- Project contribution remains totalContractRevenue - totalDirectCosts.
