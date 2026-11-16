-- Preserve each existing Business Case's historic protected assumptions when
-- loading the agent UI. The guard_agent_intelligence_assumptions trigger from
-- the preceding migration rejects any unauthorised changes on write.
-- This preserves the previous read-side privacy mask and prevents historical
-- projects changing their economics just because global defaults changed.
create or replace function public.agent_safe_business_case_data(payload jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare safe jsonb := coalesce(payload, '{}'::jsonb);
begin
  safe := safe - 'catalogue' - 'commercialSnapshot' - 'internalFinancial' - 'internalReport';
  safe := safe
    #- '{assumptions,powerAidSupplierSharePercent}'
    #- '{assumptions,commissionPercent}'
    #- '{assumptions,agent1CommissionPercent}'
    #- '{assumptions,agent2CommissionPercent}'
    #- '{assumptions,dutyCost}'
    #- '{assumptions,warrantyReservePercent}'
    #- '{assumptions,fundingCostPercent}'
    #- '{assumptions,otherDirectCosts}'
    #- '{assumptions,minimumMarginPercent}';
  if safe ? 'crm' then
    safe := jsonb_set(safe, '{crm,businessCase}',
      coalesce(safe #> '{crm,businessCase}', '{}'::jsonb)
        - 'powerAidSupplierCost' - 'powerAidVimaluxMargin'
        - 'datekArr' - 'datekContractValue' - 'internalGrossMargin', true);
  end if;
  return safe;
end;
$$;
