import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { MODULO_AVALIACAO_NAO_INSTALADO, moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";
import { unidadeSchema } from "@/lib/avaliacao/schemas";
import { UNIDADE_SELECT } from "@/lib/avaliacao/unidades-campos";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function erroUnico(message: string): boolean {
  return message.includes("avaliacao_unidades_nome_unico") || message.includes("avaliacao_unidades_cnpj_unico");
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const authz = await requireRole("viewer", { requestId, resource: "avaliacao_unidades" });
  if (!authz.ok) return authz.response;

  const activeParam = req.nextUrl.searchParams.get("active");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("avaliacao_unidades")
    .select(UNIDADE_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  // Agenda / seletores: só ativas (default). Gestão: active=all ou active=0.
  if (activeParam === "all") {
    // sem filtro
  } else if (activeParam === "0") {
    query = query.eq("is_active", false);
  } else {
    query = query.eq("is_active", true);
  }

  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,cnpj.ilike.%${safe}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }
  return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("manager", { requestId, resource: "avaliacao_unidades" });
  if (!authz.ok) return authz.response;

  const body = unidadeSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", body.error.issues[0]?.message ?? "corpo inválido", 422, { requestId });
  }

  const d = body.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacao_unidades")
    .insert({
      organization_id: authz.org.orgId,
      name: d.name,
      cnpj: d.cnpj,
      internal_code: d.internal_code ?? null,
      employee_count: d.employee_count ?? null,
      sort_order: d.sort_order ?? 0,
      is_active: d.is_active ?? true,
      cep: d.cep ?? null,
      state: d.state ?? null,
      city: d.city ?? null,
      neighborhood: d.neighborhood ?? null,
      street: d.street ?? null,
      number: d.number ?? null,
      complement: d.complement ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      responsible_name: d.responsible_name ?? null,
      notes: d.notes ?? null,
    })
    .select(UNIDADE_SELECT)
    .single();

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

  void audit({
    action: "avaliacao.unidade_criada",
    resourceType: "avaliacao_unidade",
    resourceId: data.id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
  });

  return ok(data, { requestId, status: 201 });
}
