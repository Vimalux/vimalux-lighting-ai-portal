-- VIMALUX SAFE RELEASE: global, role-protected Intelligence defaults.
-- Staging first. Do not retroactively alter Business Case snapshots.
create table if not exists public.intelligence_default_settings (
  id text primary key default 'global' check (id = 'global'),
  "values" jsonb not null check (jsonb_typeof("values") = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.intelligence_default_settings enable row level security;
revoke all on public.intelligence_default_settings from anon, authenticated;
grant select, insert, update on public.intelligence_default_settings to authenticated;

create policy "intelligence defaults authenticated read"
  on public.intelligence_default_settings for select to authenticated using (true);
create policy "intelligence defaults admin insert"
  on public.intelligence_default_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "intelligence defaults admin update"
  on public.intelligence_default_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.stamp_intelligence_default_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.revision := old.revision + 1; end if;
  return new;
end;
$$;
create trigger stamp_intelligence_defaults
  before insert or update on public.intelligence_default_settings
  for each row execute function public.stamp_intelligence_default_settings();

-- Initial staging values follow the Admin screenshot reviewed on 2026-11-16.
-- Mercury's actual calculation factor remains 1.15 (not a 115x multiplier).
insert into public.intelligence_default_settings (id, "values") values ('global',
  '{
    "operatingHours":4200,"energyPrice":0.29,"sapFactor":1.2,"mhFactor":1.15,"mercuryFactor":1.15,
    "co2KgPerKwh":0.2926,"cloPercent":15,"powerAidPercent":40,"powerAidCustomerFeePercent":40,
    "powerAidSupplierSharePercent":70,"existingMaintenance":25,"newMaintenance":5,
    "financingModel":"cash","dealType":"cash","financingPeriod":5,"serviceAgreementPeriod":10,
    "powerAidServicePeriod":10,"analysisPeriod":10,"contractYears":10,"financingYears":5,
    "rateProfileId":"custom","interestRate":8,
    "interestRateSnapshot":{"profileId":"custom","annualRate":8,"capturedAt":null},
    "allInclusiveAnnualPayment":0,"officialOfferCapex":0,"officialAnnualOpex":0,
    "upfrontPayment":0,"energyEscalation":2,"opexEscalation":0,"discountRate":5,
    "freightCostPerLamp":11,"freightSalesPerLamp":12,"dutyCost":0,
    "commissionPercent":0,"agent1Name":"","agent1CommissionPercent":0,
    "agent2Name":"","agent2CommissionPercent":0,"warrantyReservePercent":0,
    "fundingCostPercent":0,"financeTransferFee":0,"otherDirectCosts":0,"minimumMarginPercent":30
  }'::jsonb
) on conflict (id) do nothing;

-- The existing agent-saving RPC is SECURITY DEFINER. A DB trigger enforces
-- protected assumptions even when a client bypasses the hidden Admin controls.
create or replace function public.guard_agent_intelligence_assumptions()
returns trigger language plpgsql set search_path = public as $$
declare
  caller_role text;
  before_assumptions jsonb;
  after_assumptions jsonb;
  official jsonb;
  protected_key text;
begin
  if auth.uid() is null then return new; end if;
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'agent' then return new; end if;

  select "values" into official from public.intelligence_default_settings where id = 'global';
  if official is null then raise exception 'Global Intelligence defaults unavailable'; end if;
  after_assumptions := coalesce(new.intelligence_data->'assumptions', '{}'::jsonb);
  if tg_op = 'UPDATE' then
    before_assumptions := coalesce(old.intelligence_data->'assumptions', '{}'::jsonb);
  else
    before_assumptions := official;
  end if;

  for protected_key in select jsonb_object_keys(official)
  loop
    if protected_key in ('energyPrice', 'operatingHours', 'dealType',
      'financingPeriod', 'serviceAgreementPeriod', 'powerAidServicePeriod') then
      continue;
    end if;
    if after_assumptions ? protected_key and
      after_assumptions->protected_key is distinct from
      coalesce(before_assumptions->protected_key, official->protected_key) then
      raise exception 'Agent cannot change admin-controlled assumption %', protected_key;
    end if;
  end loop;
  return new;
end;
$$;

create trigger guard_agent_intelligence_assumptions
  before insert or update of intelligence_data on public.business_cases
  for each row execute function public.guard_agent_intelligence_assumptions();

-- Preserve the existing agent RPC's sanitization while additionally allowing
-- agents to submit only the six explicitly editable project assumptions.
create or replace function public.agent_safe_business_case_data(payload jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  safe jsonb := coalesce(payload, '{}'::jsonb);
  permitted_assumptions jsonb;
begin
  safe := safe - 'catalogue' - 'commercialSnapshot' - 'internalFinancial' - 'internalReport';
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    into permitted_assumptions
    from jsonb_each(coalesce(safe->'assumptions', '{}'::jsonb))
    where key in ('energyPrice', 'operatingHours', 'dealType',
      'financingPeriod', 'serviceAgreementPeriod', 'powerAidServicePeriod');
  safe := jsonb_set(safe, '{assumptions}', permitted_assumptions, true);
  if safe ? 'crm' then
    safe := jsonb_set(safe, '{crm,businessCase}',
      coalesce(safe #> '{crm,businessCase}', '{}'::jsonb)
        - 'powerAidSupplierCost' - 'powerAidVimaluxMargin'
        - 'datekArr' - 'datekContractValue' - 'internalGrossMargin', true);
  end if;
  return safe;
end;
$$;
