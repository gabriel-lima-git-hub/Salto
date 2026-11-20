-- manifest: Assistente e histórico de avaliações veiculares (pós-agendamento): tabelas avaliacao_avaliacoes e avaliacao_avaliacao_fotos; FK evaluation_record_id; bucket avaliacao-fotos; provisionadora estendida.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacao-fotos', 'avaliacao-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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


  create table if not exists public.avaliacao_avaliacoes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    contact_id uuid not null references public.contacts(id) on delete restrict,
    unit_id uuid not null references public.avaliacao_unidades(id) on delete restrict,
    consultant_user_id uuid references auth.users(id) on delete set null,
    attendant_user_id uuid references auth.users(id) on delete set null,
    agendamento_id uuid references public.avaliacao_agendamentos(id) on delete set null,
    tipo text not null default 'propria'
      check (tipo in ('propria', 'apoio', 'repasse')),
    status_laudo text not null default 'incompleta'
      check (status_laudo in ('aprovado', 'apontamento', 'reprovado', 'incompleta')),
    origem_lead text,
    avaliadores text[] not null default '{}',
    cliente_responsaveis jsonb not null default '{}'::jsonb,
    veiculo jsonb not null default '{}'::jsonb,
    historico jsonb not null default '{}'::jsonb,
    estrutura jsonb not null default '{}'::jsonb,
    opcionais jsonb not null default '{}'::jsonb,
    condicao_geral jsonb not null default '{}'::jsonb,
    dinamica jsonb not null default '{}'::jsonb,
    negocio jsonb not null default '{}'::jsonb,
    concluida_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists avaliacao_avaliacoes_org_created_idx
    on public.avaliacao_avaliacoes (organization_id, created_at desc);
  create index if not exists avaliacao_avaliacoes_org_status_idx
    on public.avaliacao_avaliacoes (organization_id, status_laudo);
  create index if not exists avaliacao_avaliacoes_contact_idx
    on public.avaliacao_avaliacoes (organization_id, contact_id);
  create index if not exists avaliacao_avaliacoes_agendamento_idx
    on public.avaliacao_avaliacoes (organization_id, agendamento_id)
    where agendamento_id is not null;
  create unique index if not exists avaliacao_avaliacoes_agendamento_unico
    on public.avaliacao_avaliacoes (organization_id, agendamento_id)
    where agendamento_id is not null;

  create table if not exists public.avaliacao_avaliacao_fotos (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    avaliacao_id uuid not null references public.avaliacao_avaliacoes(id) on delete cascade,
    storage_path text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint avaliacao_avaliacao_fotos_path_unico unique (organization_id, storage_path)
  );

  create index if not exists avaliacao_avaliacao_fotos_av_idx
    on public.avaliacao_avaliacao_fotos (organization_id, avaliacao_id, sort_order);

  if not exists (
    select 1 from pg_constraint where conname = 'avaliacao_agendamentos_evaluation_record_fk'
  ) then
    alter table public.avaliacao_agendamentos
      add constraint avaliacao_agendamentos_evaluation_record_fk
      foreign key (evaluation_record_id) references public.avaliacao_avaliacoes(id) on delete set null;
  end if;

  -- Policies em duas linhas: create policy X / on public.Y — senão a
  -- conferência do update.sh ≤v1.63.0 (regex numa linha só) cobra regra de
  -- módulo não instalado e para a atualização (#1906 / ADR-0002).
  alter table public.avaliacao_avaliacoes enable row level security;
  drop policy if exists avaliacao_avaliacoes_select on public.avaliacao_avaliacoes;
  create policy avaliacao_avaliacoes_select
    on public.avaliacao_avaliacoes
    for select using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
  drop policy if exists avaliacao_avaliacoes_insert on public.avaliacao_avaliacoes;
  create policy avaliacao_avaliacoes_insert
    on public.avaliacao_avaliacoes
    for insert with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_avaliacoes_update on public.avaliacao_avaliacoes;
  create policy avaliacao_avaliacoes_update
    on public.avaliacao_avaliacoes
    for update using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    ) with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_avaliacoes_delete on public.avaliacao_avaliacoes;
  create policy avaliacao_avaliacoes_delete
    on public.avaliacao_avaliacoes
    for delete using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'manager'))
    );
  revoke all on public.avaliacao_avaliacoes from anon;

  alter table public.avaliacao_avaliacao_fotos enable row level security;
  drop policy if exists avaliacao_avaliacao_fotos_select on public.avaliacao_avaliacao_fotos;
  create policy avaliacao_avaliacao_fotos_select
    on public.avaliacao_avaliacao_fotos
    for select using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
  drop policy if exists avaliacao_avaliacao_fotos_insert on public.avaliacao_avaliacao_fotos;
  create policy avaliacao_avaliacao_fotos_insert
    on public.avaliacao_avaliacao_fotos
    for insert with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_avaliacao_fotos_update on public.avaliacao_avaliacao_fotos;
  create policy avaliacao_avaliacao_fotos_update
    on public.avaliacao_avaliacao_fotos
    for update using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    ) with check (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    );
  drop policy if exists avaliacao_avaliacao_fotos_delete on public.avaliacao_avaliacao_fotos;
  create policy avaliacao_avaliacao_fotos_delete
    on public.avaliacao_avaliacao_fotos
    for delete using (
      public.fn_is_platform_admin()
      or (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'))
    );
  revoke all on public.avaliacao_avaliacao_fotos from anon;


  perform public.fn_avaliacao_declarar_secoes_lgpd();
  perform public.fn_proteger_modulo_provisionado();
end;
$f$;

revoke execute on function public.fn_avaliacao_provisionar() from public, anon, authenticated;
grant execute on function public.fn_avaliacao_provisionar() to service_role;

create or replace function public.fn_avaliacao_declarar_secoes_lgpd()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $f$
begin
  if to_regclass('public.avaliacao_agendamentos') is null then
    return;
  end if;

  insert into public.modulo_secoes_lgpd
      (modulo, tabela, ligacao, colunas, colunas_rotulo, colunas_redigidas, colunas_agora)
    values (
      'avaliacao',
      'avaliacao_agendamentos',
      'organization_id = $1 and contact_id = $2',
      array['notes', 'client_email', 'vehicle_plate', 'vehicle_brand', 'vehicle_model'],
      '{}'::text[],
      '{}'::text[],
      array['updated_at']
    )
    on conflict (modulo, tabela) do update
      set ligacao = excluded.ligacao,
          colunas = excluded.colunas,
          colunas_rotulo = excluded.colunas_rotulo,
          colunas_redigidas = excluded.colunas_redigidas,
          colunas_agora = excluded.colunas_agora;

  if to_regclass('public.avaliacao_avaliacoes') is null then
    return;
  end if;

  insert into public.modulo_secoes_lgpd
      (modulo, tabela, ligacao, colunas, colunas_rotulo, colunas_redigidas, colunas_agora)
    values (
      'avaliacao',
      'avaliacao_avaliacoes',
      'organization_id = $1 and contact_id = $2',
      array['origem_lead', 'avaliadores', 'cliente_responsaveis', 'veiculo', 'historico', 'estrutura', 'opcionais', 'condicao_geral', 'dinamica', 'negocio'],
      '{}'::text[],
      '{}'::text[],
      array['updated_at']
    )
    on conflict (modulo, tabela) do update
      set ligacao = excluded.ligacao,
          colunas = excluded.colunas,
          colunas_rotulo = excluded.colunas_rotulo,
          colunas_redigidas = excluded.colunas_redigidas,
          colunas_agora = excluded.colunas_agora;
end;
$f$;

revoke execute on function public.fn_avaliacao_declarar_secoes_lgpd() from public, anon, authenticated;
grant execute on function public.fn_avaliacao_declarar_secoes_lgpd() to service_role;


do $f$ begin perform public.fn_reaplicar_modulos_instalados(); end $f$;
