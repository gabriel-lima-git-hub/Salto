import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { atualizarUnidadeSchema } from "@/lib/avaliacao/schemas";
import { UNIDADE_SELECT } from "@/lib/avaliacao/unidades-campos";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

function erroUnico(message: string): boolean {
  return message.includes("avaliacao_unidades_nome_unico") || message.includes("avaliacao_unidades_cnpj_unico");
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const authz = await requireRole("viewer", { requestId, resource: "avaliacao_unidades" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacao_unidades")
    .select(UNIDADE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Unidade não encontrada.", 404, { requestId });
  return ok(data, { requestId });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("manager", { requestId, resource: "avaliacao_unidades" });
  if (!authz.ok) return authz.response;

  const body = atualizarUnidadeSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", body.error.issues[0]?.message ?? "corpo inválido", 422, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacao_unidades")
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(UNIDADE_SELECT)
    .maybeSingle();

  if (error) {
    if (erroUnico(error.message)) {
      return fail(
        "state_conflict",
        error.message.includes("cnpj")
          ? "Já existe uma unidade com este CNPJ nesta organização."
          : "Já existe uma unidade com este nome nesta organização.",
        409,
        { requestId },
      );
    }
    return fail("internal_error", error.message, 500, { requestId });
  }
  if (!data) return fail("not_found", "Unidade não encontrada.", 404, { requestId });

  void audit({
    action: "avaliacao.unidade_atualizada",
    resourceType: "avaliacao_unidade",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
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

  const authz = await requireRole("manager", { requestId, resource: "avaliacao_unidades" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();

  const { count, error: countErr } = await supabase
    .from("avaliacao_agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", id);

  if (countErr) return fail("internal_error", countErr.message, 500, { requestId });
  if ((count ?? 0) > 0) {
    return fail(
      "state_conflict",
      "Esta unidade tem agendamentos. Inative-a em vez de excluir, para preservar o histórico.",
      409,
      { requestId },
    );
  }

  const { data, error } = await supabase
    .from("avaliacao_unidades")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Unidade não encontrada.", 404, { requestId });

  void audit({
    action: "avaliacao.unidade_atualizada",
    resourceType: "avaliacao_unidade",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { deleted: true },
  });

  return ok({ id }, { requestId });
}
