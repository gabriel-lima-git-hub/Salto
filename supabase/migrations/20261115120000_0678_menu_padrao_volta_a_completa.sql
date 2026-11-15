-- manifest: Restaura o DEFAULT de interface_settings para completa — o preset simplificada (Agenda/Contatos/Casos) continua escolhível; não reescreve orgs que já escolheram simplificada.

-- Quem aplicou a 0677 intermediária (default da coluna = simplificada) volta ao
-- contrato: Completa é o padrão de coluna; Simplificada é escolha na tela.
-- Não há UPDATE de linhas: org que já gravou simplificada mantém a escolha.
alter table public.organizations
  alter column interface_settings set default '{"preset":"completa"}'::jsonb;

alter table public.user_organizations
  alter column interface_settings set default '{"preset":"completa"}'::jsonb;

alter table public.team_invites
  alter column interface_settings set default '{"preset":"completa"}'::jsonb;

create or replace function public.fn_accept_team_invite(
 p_user uuid, p_org uuid, p_role text, p_invited_by uuid,
 p_issued_at timestamptz, p_invited_at timestamptz
) returns jsonb language sql security definer set search_path = public, pg_temp as $$
 select public.fn_accept_team_invite(p_user,p_org,p_role,p_invited_by,p_issued_at,p_invited_at,'{"preset":"completa"}'::jsonb);
$$;
revoke all on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz) to service_role;
