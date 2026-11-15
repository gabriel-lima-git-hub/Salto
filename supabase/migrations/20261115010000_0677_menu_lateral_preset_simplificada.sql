-- manifest: Menu lateral padrão do produto passa a ser o preset simplificada (Agenda, Contatos, Casos); completa continua escolhível.

-- Defaults: instalação nova e org/vínculo sem valor explícito nascem enxutos.
alter table public.organizations
  alter column interface_settings set default '{"preset":"simplificada"}'::jsonb;

alter table public.user_organizations
  alter column interface_settings set default '{"preset":"simplificada"}'::jsonb;

alter table public.team_invites
  alter column interface_settings set default '{"preset":"simplificada"}'::jsonb;

-- Quem ainda está no preset completa SEM personalização (destinos) passa ao enxuto.
-- Personalização explícita (destinos) e quem já escolheu simplificada ficam intactos.
update public.organizations
   set interface_settings = '{"preset":"simplificada"}'::jsonb
 where interface_settings = '{"preset":"completa"}'::jsonb;

update public.user_organizations
   set interface_settings = '{"preset":"simplificada"}'::jsonb
 where interface_settings = '{"preset":"completa"}'::jsonb;

update public.team_invites
   set interface_settings = '{"preset":"simplificada"}'::jsonb
 where interface_settings = '{"preset":"completa"}'::jsonb
   and accepted_at is null
   and revoked_at is null;

-- Aceite de convite sem settings no token: mesmo padrão.
create or replace function public.fn_accept_team_invite(
 p_user uuid, p_org uuid, p_role text, p_invited_by uuid,
 p_issued_at timestamptz, p_invited_at timestamptz
) returns jsonb language sql security definer set search_path = public, pg_temp as $$
 select public.fn_accept_team_invite(p_user,p_org,p_role,p_invited_by,p_issued_at,p_invited_at,'{"preset":"simplificada"}'::jsonb);
$$;
revoke all on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz) to service_role;

create or replace function public.fn_create_tenant_with_owner(
  p_actor uuid, p_key uuid, p_request jsonb, p_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  prior public.idempotency_keys%rowtype;
  org public.organizations%rowtype;
  result jsonb;
  dono_e_outra_pessoa boolean;
  v_plano_id uuid;
  v_trial_dias integer;
begin
  if not exists (select 1 from public.platform_admins where user_id = p_actor
    and revoked_at is null and scope = 'full') then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_key::text, 0));
  select * into prior from public.idempotency_keys
    where key = p_key::text and endpoint = '/api/v1/admin/tenants:' || p_actor::text
      and expires_at > now() and tenant_creation_trusted;
  if found then
    if prior.request_hash <> decode(p_hash, 'hex') then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    if prior.response_body->>'id' is distinct from prior.organization_id::text
      or not exists (select 1 from public.organizations where id = prior.organization_id and created_by = p_actor) then
      raise exception 'idempotency_provenance_invalid' using errcode = '22023';
    end if;
    return prior.response_body || jsonb_build_object('created', false);
  end if;

  -- 0583: plano da cobrança do revendedor. Com a chave desligada o formulário não
  -- oferece plano; um plano_id que chegue assim é recusado, em vez de criar uma
  -- assinatura que nenhuma régua lê. Validado DEPOIS da autorização.
  v_plano_id := nullif(p_request->>'plano_id', '')::uuid;
  if v_plano_id is not null then
    if not public.fn_cobranca_ligada() then
      raise exception 'cobranca_desligada' using errcode = '22023';
    end if;
    select p.trial_dias into v_trial_dias
      from public.cobranca_planos p
     where p.id = v_plano_id and p.arquivado_em is null;
    if not found then
      raise exception 'plano_invalido' using errcode = '22023';
    end if;
  end if;

  -- A MESMA comparação que já decidia `interface_settings`, agora com nome e
  -- guardada. Era ela que sabia a resposta e não a anotava em lugar nenhum.
  dono_e_outra_pessoa := lower(p_request->>'owner_email') is distinct from
    (select lower(email) from auth.users where id = p_actor);

  insert into public.organizations(display_name, slug, legal_name, cnpj, status, settings, created_by)
    values (p_request->>'display_name', p_request->>'slug', coalesce(nullif(p_request->>'legal_name', ''), p_request->>'display_name'),
      p_request->>'cnpj', 'active',
      -- 0583: com a cobrança ligada a rota não manda `plan`; sem esta guarda a org
      -- nasceria com {"plan": null} e o rótulo antigo apareceria como "—".
      case when p_request ? 'plan' then jsonb_build_object('plan', p_request->>'plan') else '{}'::jsonb end,
      p_actor)
    returning * into org;
  insert into public.user_organizations(organization_id, user_id, role, accepted_at, interface_settings, provisional_until_handover)
    values (org.id, p_actor, 'admin', now(),
      case when dono_e_outra_pessoa
        then '{"preset":"simplificada"}'::jsonb
        else coalesce(p_request->'owner_interface_settings', '{"preset":"simplificada"}'::jsonb) end,
      dono_e_outra_pessoa);
  -- 0583: a assinatura nasce na MESMA transação da organização.
  if v_plano_id is not null then
    insert into public.cobranca_assinaturas (organization_id, plano_id, estado, trial_ate)
      values (org.id, v_plano_id, 'trial', now() + make_interval(days => v_trial_dias));
  end if;
  result := jsonb_build_object('id', org.id, 'slug', org.slug, 'display_name', org.display_name,
    'invite_id', gen_random_uuid(), 'issued_at', floor(extract(epoch from now()))::bigint);
  insert into public.idempotency_keys(organization_id, key, endpoint, request_hash, status_code, response_body, tenant_creation_trusted)
    values (org.id, p_key::text, '/api/v1/admin/tenants:' || p_actor::text,
      decode(p_hash, 'hex'), 201, result, true);
  return result || jsonb_build_object('created', true);
end $$;

revoke all on function public.fn_create_tenant_with_owner(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_create_tenant_with_owner(uuid, uuid, jsonb, text) to service_role;
