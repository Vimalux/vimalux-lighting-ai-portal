create table if not exists public.intelligence_catalogue (
  id text primary key,
  led jsonb not null default '[]'::jsonb,
  smart jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_projects (
  id text primary key,
  data jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.intelligence_catalogue enable row level security;
alter table public.intelligence_projects enable row level security;

create policy "authenticated catalogue read" on public.intelligence_catalogue for select to authenticated using (true);
create policy "authenticated catalogue insert" on public.intelligence_catalogue for insert to authenticated with check (true);
create policy "authenticated catalogue update" on public.intelligence_catalogue for update to authenticated using (true) with check (true);
create policy "authenticated catalogue delete" on public.intelligence_catalogue for delete to authenticated using (true);

create policy "authenticated projects read" on public.intelligence_projects for select to authenticated using (true);
create policy "authenticated projects insert" on public.intelligence_projects for insert to authenticated with check (true);
create policy "authenticated projects update" on public.intelligence_projects for update to authenticated using (true) with check (true);
create policy "authenticated projects delete" on public.intelligence_projects for delete to authenticated using (true);

create or replace function public.set_intelligence_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists intelligence_catalogue_updated_at on public.intelligence_catalogue;
create trigger intelligence_catalogue_updated_at before update on public.intelligence_catalogue for each row execute function public.set_intelligence_updated_at();
drop trigger if exists intelligence_projects_updated_at on public.intelligence_projects;
create trigger intelligence_projects_updated_at before update on public.intelligence_projects for each row execute function public.set_intelligence_updated_at();
