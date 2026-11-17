-- VIMALUX SAFE RELEASE: staging-first commercial exception approval.
-- Does not rewrite or approve any existing Business Case.
-- Approval is bound to the exact server-side sync_version and expires on any edit.
create table if not exists public.intelligence_commercial_approvals (
  case_id uuid primary key references public.business_cases(id) on delete cascade,
  approved_sync_version bigint not null check (approved_sync_version >= 0),
  reason text not null check (length(btrim(reason)) between 12 and 2000),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now()
);

alter table public.intelligence_commercial_approvals enable row level security;
revoke all on public.intelligence_commercial_approvals from public, anon, authenticated;
-- No direct table access from browsers. The audited RPCs below are the only API.

create or replace function public.get_intelligence_commercial_approval(case_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  bc public.business_cases%rowtype;
  approval public.intelligence_commercial_approvals%rowtype;
  can_view boolean;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  select role into caller_role from public.profiles where id = caller_id;
  select * into bc from public.business_cases where id = case_id;
  if not found then raise exception 'Business Case not found'; end if;
  can_view := caller_role in ('admin', 'vimalux', 'sales_manager')
    or (caller_role = 'agent' and (
      bc.assigned_to = caller_id
      or (bc.assigned_to is null and bc.created_by = caller_id)
      or (bc.crm_opportunity_id is not null and public.is_project_collaborator(bc.crm_opportunity_id, caller_id))
    ));
  if not coalesce(can_view, false) then raise exception 'Business Case access denied'; end if;

  select * into approval from public.intelligence_commercial_approvals where intelligence_commercial_approvals.case_id = bc.id;
  return jsonb_build_object(
    'approved', approval.case_id is not null and approval.approved_sync_version = bc.sync_version,
    'syncVersion', bc.sync_version,
    'approvedAt', case when caller_role in ('admin','vimalux','sales_manager') then approval.approved_at else null end,
    'approvedBy', case when caller_role in ('admin','vimalux','sales_manager') then approval.approved_by else null end,
    'approvalReason', case when caller_role in ('admin','vimalux','sales_manager') then approval.reason else null end
  );
end;
$$;

create or replace function public.approve_intelligence_commercial_exception(case_id uuid, approval_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  bc public.business_cases%rowtype;
begin
  if caller_id is null or not (select public.is_admin()) then
    raise exception 'Only VIMALUX Admin may approve commercial exceptions';
  end if;
  if length(btrim(coalesce(approval_reason, ''))) not between 12 and 2000 then
    raise exception 'An approval reason of 12-2000 characters is required';
  end if;
  select * into bc from public.business_cases where id = case_id for update;
  if not found then raise exception 'Business Case not found'; end if;
  insert into public.intelligence_commercial_approvals
    (case_id, approved_sync_version, reason, approved_by, approved_at)
  values (bc.id, bc.sync_version, btrim(approval_reason), caller_id, now())
  on conflict (case_id) do update set
    approved_sync_version = excluded.approved_sync_version,
    reason = excluded.reason,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at;
  return public.get_intelligence_commercial_approval(case_id);
end;
$$;

create or replace function public.revoke_intelligence_commercial_exception(case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null or not (select public.is_admin()) then
    raise exception 'Only VIMALUX Admin may revoke commercial exceptions';
  end if;
  delete from public.intelligence_commercial_approvals where intelligence_commercial_approvals.case_id = revoke_intelligence_commercial_exception.case_id;
  return public.get_intelligence_commercial_approval(case_id);
end;
$$;

revoke all on function public.get_intelligence_commercial_approval(uuid) from public, anon;
revoke all on function public.approve_intelligence_commercial_exception(uuid,text) from public, anon;
revoke all on function public.revoke_intelligence_commercial_exception(uuid) from public, anon;
grant execute on function public.get_intelligence_commercial_approval(uuid) to authenticated;
grant execute on function public.approve_intelligence_commercial_exception(uuid,text) to authenticated;
grant execute on function public.revoke_intelligence_commercial_exception(uuid) to authenticated;
