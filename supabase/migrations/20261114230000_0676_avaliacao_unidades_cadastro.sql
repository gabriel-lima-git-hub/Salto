-- manifest: Cadastro completo de unidades do módulo avaliação — CNPJ, endereço, contato e responsável em avaliacao_unidades; unique parcial de CNPJ por org; provisionadora reaplica colunas sem quebrar unit_id dos agendamentos.

create or replace function public.fn_avaliacao_provisionar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $f$
begin
  create table if not exists public.avaliacao_unidades (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null check (char_length(trim(name)) > 0),
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint avaliacao_unidades_nome_unico unique (organization_id, name)
  );

  -- Upgrade idempotente (ADR-0002 D2): instalação antiga só tinha name/sort/active.
  alter table public.avaliacao_unidades add column if not exists cnpj text;
  alter table public.avaliacao_unidades add column if not exists internal_code text;
  alter table public.avaliacao_unidades add column if not exists employee_count integer;
  alter table public.avaliacao_unidades add column if not exists cep text;
  alter table public.avaliacao_unidades add column if not exists state text;
  alter table public.avaliacao_unidades add column if not exists city text;
  alter table public.avaliacao_unidades add column if not exists neighborhood text;
  alter table public.avaliacao_unidades add column if not exists street text;
  alter table public.avaliacao_unidades add column if not exists number text;
  alter table public.avaliacao_unidades add column if not exists complement text;
  alter table public.avaliacao_unidades add column if not exists phone text;
  alter table public.avaliacao_unidades add column if not exists email text;
  alter table public.avaliacao_unidades add column if not exists responsible_name text;
  alter table public.avaliacao_unidades add column if not exists notes text;

  alter table public.avaliacao_unidades drop constraint if exists avaliacao_unidades_employee_count_check;
  alter table public.avaliacao_unidades
    add constraint avaliacao_unidades_employee_count_check
    check (employee_count is null or employee_count >= 0);

  alter table public.avaliacao_unidades drop constraint if exists avaliacao_unidades_state_check;
  alter table public.avaliacao_unidades
    add constraint avaliacao_unidades_state_check
    check (state is null or state ~ '^[A-Z]{2}$');

  alter table public.avaliacao_unidades drop constraint if exists avaliacao_unidades_cnpj_formato;
  alter table public.avaliacao_unidades
    add constraint avaliacao_unidades_cnpj_formato
    check (cnpj is null or cnpj ~ '^[0-9A-Z]{14}$');

  create index if not exists avaliacao_unidades_org_idx
    on public.avaliacao_unidades (organization_id);

  -- CNPJ único por org quando preenchido; linhas legadas sem CNPJ continuam válidas.
  create unique index if not exists avaliacao_unidades_cnpj_unico
    on public.avaliacao_unidades (organization_id, cnpj)
    where cnpj is not null;

  create table if not exists public.avaliacao_agendamentos (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    contact_id uuid not null references public.contacts(id) on delete restrict,
    lead_id uuid references public.crm_leads(id) on delete set null,
    unit_id uuid not null references public.avaliacao_unidades(id) on delete restrict,
    consultant_user_id uuid references auth.users(id) on delete set null,
    attendant_user_id uuid references auth.users(id) on delete set null,
    scheduled_at timestamptz not null,
    duration_minutes integer not null default 20 check (duration_minutes > 0 and duration_minutes <= 480),
    client_email text,
    vehicle_plate text,
    vehicle_brand text,
    vehicle_model text,
    notes text,
    status text not null default 'agendado'
      check (status in ('agendado', 'em_avaliacao', 'cancelado', 'atrasado', 'aguardando', 'avaliado')),
    external_id text,
    evaluation_started_at timestamptz,
    cancelled_at timestamptz,
    evaluated_at timestamptz,
    evaluation_record_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint avaliacao_agendamentos_ext_unico unique (organization_id, external_id)
  );

  create index if not exists avaliacao_agendamentos_org_scheduled_idx
    on public.avaliacao_agendamentos (organization_id, scheduled_at);
  create index if not exists avaliacao_agendamentos_org_status_idx
    on public.avaliacao_agendamentos (organization_id, status);
  create index if not exists avaliacao_agendamentos_contact_idx
    on public.avaliacao_agendamentos (organization_id, contact_id);
  create index if not exists avaliacao_agendamentos_plate_idx
    on public.avaliacao_agendamentos (organization_id, vehicle_plate)
    where vehicle_plate is not null;

  alter table public.avaliacao_unidades enable row level security;
  drop policy if exists tenant_isolation_avaliacao_unidades_all on public.avaliacao_unidades;
  drop policy if exists avaliacao_unidades_select on public.avaliacao_unidades;
  create policy avaliacao_unidades_select
    on public.avaliacao_unidades
    for select using (
      organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
    );
  drop policy if exists avaliacao_unidades_insert on public.avaliacao_unidades;
  create policy avaliacao_unidades_insert
    on public.avaliacao_unidades
    for insert with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'manager'))
    );
  drop policy if exists avaliacao_unidades_update on public.avaliacao_unidades;
  create policy avaliacao_unidades_update
    on public.avaliacao_unidades
    for update using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'manager'))
    ) with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'manager'))
    );
  drop policy if exists avaliacao_unidades_delete on public.avaliacao_unidades;
  create policy avaliacao_unidades_delete
    on public.avaliacao_unidades
    for delete using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'manager'))
    );
  revoke all on public.avaliacao_unidades from anon;

  alter table public.avaliacao_agendamentos enable row level security;
  drop policy if exists tenant_isolation_avaliacao_agendamentos_all on public.avaliacao_agendamentos;
  drop policy if exists avaliacao_agendamentos_select on public.avaliacao_agendamentos;
  create policy avaliacao_agendamentos_select
    on public.avaliacao_agendamentos
    for select using (
      organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
    );
  drop policy if exists avaliacao_agendamentos_insert on public.avaliacao_agendamentos;
  create policy avaliacao_agendamentos_insert
    on public.avaliacao_agendamentos
    for insert with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_agendamentos_update on public.avaliacao_agendamentos;
  create policy avaliacao_agendamentos_update
    on public.avaliacao_agendamentos
    for update using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'agent'))
    ) with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_agendamentos_delete on public.avaliacao_agendamentos;
  create policy avaliacao_agendamentos_delete
    on public.avaliacao_agendamentos
    for delete using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids())
          and public.fn_role_at_least(organization_id, 'manager'))
    );
  revoke all on public.avaliacao_agendamentos from anon;

  drop trigger if exists avaliacao_agendamentos_status_guard on public.avaliacao_agendamentos;
  create trigger avaliacao_agendamentos_status_guard
    before update on public.avaliacao_agendamentos
    for each row execute function public.trg_avaliacao_status_guard();

  perform public.fn_avaliacao_declarar_secoes_lgpd();
  perform public.fn_proteger_modulo_provisionado();
end;
$f$;

revoke execute on function public.fn_avaliacao_provisionar() from public, anon, authenticated;
grant execute on function public.fn_avaliacao_provisionar() to service_role;

-- Instalações que já têm o módulo: reaplica e ganha as colunas sem tocar nos FKs.
do $f$ begin perform public.fn_reaplicar_modulos_instalados(); end $f$;
