import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { atualizarAvaliacaoSchema } from "@/lib/avaliacao/ficha";
import { MODULO_AVALIACAO_NAO_INSTALADO, moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, organization_id, contact_id, unit_id, consultant_user_id, attendant_user_id, agendamento_id, tipo, status_laudo, origem_lead, avaliadores, cliente_responsaveis, veiculo, historico, estrutura, opcionais, condicao_geral, dinamica, negocio, concluida_at, created_at, updated_at, contacts(name, phone_number, email), avaliacao_unidades(name), avaliacao_avaliacao_fotos(id, storage_path, sort_order)";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const authz = await requireRole("viewer", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacao_avaliacoes")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }
  if (!data) return fail("not_found", "Avaliação não encontrada.", 404, { requestId });
  return ok(data, { requestId });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const body = atualizarAvaliacaoSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", body.error.issues[0]?.message ?? "corpo inválido", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("avaliacao_avaliacoes")
    .select("id, concluida_at")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Avaliação não encontrada.", 404, { requestId });

  const { data, error } = await supabase
    .from("avaliacao_avaliacoes")
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(SELECT)
    .single();

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  void audit({
    action: "avaliacao.avaliacao_atualizada",
    resourceType: "avaliacao_avaliacao",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { campos: Object.keys(body.data) },
  });

  return ok(data, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("manager", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacao_avaliacoes")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }
  if (!data) return fail("not_found", "Avaliação não encontrada.", 404, { requestId });

  void audit({
    action: "avaliacao.avaliacao_excluida",
    resourceType: "avaliacao_avaliacao",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
  });

  return ok({ id }, { requestId });
}
