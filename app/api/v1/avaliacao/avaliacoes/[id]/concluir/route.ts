import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  concluirAvaliacaoSchema,
  MINIMO_DE_FOTOS,
  veiculoProntoParaConcluir,
} from "@/lib/avaliacao/ficha";
import { MODULO_AVALIACAO_NAO_INSTALADO, moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const body = concluirAvaliacaoSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", body.error.issues[0]?.message ?? "corpo inválido", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data: av, error } = await supabase
    .from("avaliacao_avaliacoes")
    .select("id, veiculo, cliente_responsaveis, agendamento_id, concluida_at")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }
  if (!av) return fail("not_found", "Avaliação não encontrada.", 404, { requestId });
  if (av.concluida_at) return fail("conflict", "Avaliação já concluída.", 409, { requestId });

  const faltaVeiculo = veiculoProntoParaConcluir(av.veiculo, av.cliente_responsaveis);
  if (faltaVeiculo) return fail("validation_failed", faltaVeiculo, 422, { requestId });

  const { count, error: fotosErr } = await supabase
    .from("avaliacao_avaliacao_fotos")
    .select("id", { count: "exact", head: true })
    .eq("avaliacao_id", id)
    .eq("organization_id", authz.org.orgId);

  if (fotosErr) return fail("internal_error", fotosErr.message, 500, { requestId });
  if ((count ?? 0) < MINIMO_DE_FOTOS) {
    return fail(
      "validation_failed",
      `Envie pelo menos ${MINIMO_DE_FOTOS} fotos para concluir a avaliação.`,
      422,
      { requestId },
    );
  }

  const agora = new Date().toISOString();
  const { data, error: updErr } = await supabase
    .from("avaliacao_avaliacoes")
    .update({
      status_laudo: body.data.status_laudo,
      concluida_at: agora,
      updated_at: agora,
    })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id, status_laudo, concluida_at, agendamento_id")
    .single();

  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  if (data.agendamento_id) {
    const { error: rpcErr } = await supabase.rpc("fn_avaliacao_transicao_status", {
      p_org: authz.org.orgId,
      p_id: data.agendamento_id,
      p_acao: "concluir",
    });
    if (rpcErr && !rpcErr.message.includes("avaliacao_transicao_invalida")) {
      return fail("internal_error", rpcErr.message, 500, { requestId });
    }
  }

  void audit({
    action: "avaliacao.avaliacao_concluida",
    resourceType: "avaliacao_avaliacao",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { status_laudo: body.data.status_laudo },
  });

  return ok(data, { requestId });
}
