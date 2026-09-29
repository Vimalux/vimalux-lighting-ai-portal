-- VIMALUX SAFE RELEASE
-- Production candidate only. Apply to staging first and validate before production.
--
-- Intelligence remains authoritative only for the direct-cost fields listed below.
-- CRM-owned revenue basis, selling prices, margin basis, bonus and minimum margin
-- are intentionally not touched by this trigger.

create or replace function public.sync_intelligence_internal_financials_to_project()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  financial jsonb := new.intelligence_data->'internalFinancial';
  caller_id uuid := auth.uid();
  n_luminaire numeric;
  n_datek numeric;
  n_felicity numeric;
  n_installation numeric;
  n_freight numeric;
  n_other numeric;
  n_commission numeric;
  n_finance numeric;
begin
  if new.crm_opportunity_id is null or jsonb_typeof(financial) is distinct from 'object' then
    return new;
  end if;

  n_luminaire := case when jsonb_typeof(financial->'luminaire_costs') = 'number' then greatest(0, (financial->>'luminaire_costs')::numeric) else null end;
  n_datek := case when jsonb_typeof(financial->'datek_costs') = 'number' then greatest(0, (financial->>'datek_costs')::numeric) else null end;
  n_felicity := case when jsonb_typeof(financial->'felicity_costs') = 'number' then greatest(0, (financial->>'felicity_costs')::numeric) else null end;
  n_installation := case when jsonb_typeof(financial->'installation_costs') = 'number' then greatest(0, (financial->>'installation_costs')::numeric) else null end;
  n_freight := case when jsonb_typeof(financial->'freight_costs') = 'number' then greatest(0, (financial->>'freight_costs')::numeric) else null end;
  n_other := case when jsonb_typeof(financial->'other_direct_costs') = 'number' then greatest(0, (financial->>'other_direct_costs')::numeric) else null end;
  n_commission := case when jsonb_typeof(financial->'agent_commission') = 'number' then greatest(0, (financial->>'agent_commission')::numeric) else null end;
  n_finance := case when jsonb_typeof(financial->'finance_costs') = 'number' then greatest(0, (financial->>'finance_costs')::numeric) else null end;

  insert into public.project_financials (
    project_id,
    luminaire_costs,
    datek_costs,
    felicity_costs,
    installation_costs,
    freight_costs,
    other_direct_costs,
    agent_commission,
    finance_costs,
    updated_at,
    updated_by
  ) values (
    new.crm_opportunity_id,
    coalesce(n_luminaire, 0),
    coalesce(n_datek, 0),
    coalesce(n_felicity, 0),
    coalesce(n_installation, 0),
    coalesce(n_freight, 0),
    coalesce(n_other, 0),
    coalesce(n_commission, 0),
    coalesce(n_finance, 0),
    now(),
    caller_id
  )
  on conflict (project_id) do update set
    luminaire_costs = coalesce(n_luminaire, project_financials.luminaire_costs),
    datek_costs = coalesce(n_datek, project_financials.datek_costs),
    felicity_costs = coalesce(n_felicity, project_financials.felicity_costs),
    installation_costs = coalesce(n_installation, project_financials.installation_costs),
    freight_costs = coalesce(n_freight, project_financials.freight_costs),
    other_direct_costs = coalesce(n_other, project_financials.other_direct_costs),
    agent_commission = coalesce(n_commission, project_financials.agent_commission),
    finance_costs = coalesce(n_finance, project_financials.finance_costs),
    updated_at = now(),
    updated_by = coalesce(caller_id, project_financials.updated_by);

  return new;
end;
$$;

drop trigger if exists trg_sync_intelligence_internal_financials on public.business_cases;
create trigger trg_sync_intelligence_internal_financials
after insert or update of intelligence_data, crm_opportunity_id on public.business_cases
for each row
execute function public.sync_intelligence_internal_financials_to_project();

-- Rollback:
-- drop trigger if exists trg_sync_intelligence_internal_financials on public.business_cases;
-- drop function if exists public.sync_intelligence_internal_financials_to_project();
