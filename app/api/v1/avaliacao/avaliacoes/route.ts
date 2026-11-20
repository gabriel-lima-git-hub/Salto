import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { criarAvaliacaoSchema, listarAvaliacoesSchema } from "@/lib/avaliacao/ficha";
import { MODULO_AVALIACAO_NAO_INSTALADO, moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";
import { resolverContatoParaAgendamento } from "@/lib/avaliacao/resolver-contato";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT_LISTA =
  "id, contact_id, unit_id, consultant_user_id, attendant_user_id, agendamento_id, tipo, status_laudo, origem_lead, avaliadores, veiculo, cliente_responsaveis, concluida_at, created_at, updated_at, contacts(name, phone_number, email), avaliacao_unidades(name)";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const authz = await requireRole("viewer", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const parsed = listarAvaliacoesSchema.safeParse({
    unit_id: url.searchParams.get("unit_id") ?? undefined,
    consultant_user_id: url.searchParams.get("consultant_user_id") ?? undefined,
    de: url.searchParams.get("de") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
    aba: url.searchParams.get("aba") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", parsed.error.issues[0]?.message ?? "filtros inválidos", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  let q = supabase
    .from("avaliacao_avaliacoes")
    .select(SELECT_LISTA)
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (parsed.data.unit_id) q = q.eq("unit_id", parsed.data.unit_id);
  if (parsed.data.consultant_user_id) q = q.eq("consultant_user_id", parsed.data.consultant_user_id);
  if (parsed.data.de) q = q.gte("created_at", parsed.data.de);
  if (parsed.data.ate) q = q.lte("created_at", parsed.data.ate);
  if (parsed.data.aba === "concluido") q = q.not("concluida_at", "is", null);
  if (parsed.data.aba === "incompleta") q = q.is("concluida_at", null);

  const { data, error } = await q;
  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  let lista = data ?? [];
  const termo = parsed.data.q?.toLowerCase();
  if (termo) {
    lista = lista.filter((row) => {
      const c = row.contacts as
        | { name?: string; phone_number?: string }
        | { name?: string; phone_number?: string }[]
        | null;
      const contato = Array.isArray(c) ? c[0] : c;
      const veiculo = (row.veiculo ?? {}) as Record<string, string | undefined>;
      const nome = contato?.name?.toLowerCase() ?? "";
      const placa = (veiculo.placa ?? "").toLowerCase();
      const modelo = (veiculo.modelo ?? "").toLowerCase();
      const marca = (veiculo.marca ?? "").toLowerCase();
      return (
        nome.includes(termo) || placa.includes(termo) || modelo.includes(termo) || marca.includes(termo)
      );
    });
  }

  return ok(lista, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacoes" });
  if (!authz.ok) return authz.response;

  const body = criarAvaliacaoSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", body.error.issues[0]?.message ?? "corpo inválido", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  let contactId: string;
  try {
    const contato = await resolverContatoParaAgendamento(
      supabase,
      authz.org.orgId,
      {
        contact_id: body.data.contact_id,
        client_name: body.data.client_name,
        client_phone: body.data.client_phone,
        client_email: body.data.client_email || undefined,
      },
      authz.user.id,
    );
    contactId = contato.contact_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "contact_not_found" || msg === "client_required") {
      return fail("validation_failed", "Informe o contato ou nome e WhatsApp.", 422, { requestId });
    }
    return fail("internal_error", msg, 500, { requestId });
  }

  const { data, error } = await supabase
    .from("avaliacao_avaliacoes")
    .insert({
      organization_id: authz.org.orgId,
      contact_id: contactId,
      unit_id: body.data.unit_id,
      consultant_user_id: body.data.consultant_user_id ?? null,
      attendant_user_id: body.data.attendant_user_id ?? authz.user.id,
      agendamento_id: body.data.agendamento_id ?? null,
      tipo: body.data.tipo,
      origem_lead: body.data.origem_lead ?? null,
      avaliadores: body.data.avaliadores ?? [],
      cliente_responsaveis: {
        ...(body.data.cliente_responsaveis ?? {}),
        nome: body.data.client_name,
        whatsapp: body.data.client_phone,
        email: body.data.client_email || undefined,
      },
      veiculo: body.data.veiculo ?? {},
      status_laudo: "incompleta",
    })
    .select(SELECT_LISTA)
    .single();

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  if (body.data.agendamento_id) {
    await supabase
      .from("avaliacao_agendamentos")
      .update({ evaluation_record_id: data.id, updated_at: new Date().toISOString() })
      .eq("id", body.data.agendamento_id)
      .eq("organization_id", authz.org.orgId);
  }

  void audit({
    action: "avaliacao.avaliacao_criada",
    resourceType: "avaliacao_avaliacao",
    resourceId: data.id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { tipo: body.data.tipo, agendamento_id: body.data.agendamento_id ?? null },
  });

  return ok(data, { requestId, status: 201 });
}
