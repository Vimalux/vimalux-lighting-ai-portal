-- Staging regression: disambiguate the ON CONFLICT target from the RPC's case_id argument.
-- Production must apply this immediately after the preceding migration.
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
  on conflict on constraint intelligence_commercial_approvals_pkey do update set
    approved_sync_version = excluded.approved_sync_version,
    reason = excluded.reason,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at;
  return public.get_intelligence_commercial_approval(case_id);
end;
$$;

revoke all on function public.approve_intelligence_commercial_exception(uuid,text) from public, anon;
grant execute on function public.approve_intelligence_commercial_exception(uuid,text) to authenticated;
