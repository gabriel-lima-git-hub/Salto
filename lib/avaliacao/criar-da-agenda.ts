import type { SupabaseClient } from "@supabase/supabase-js";

import { moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";

export type ResultadoCriarDaAgenda =
  | { ok: true; avaliacao_id: string; criada: boolean }
  | { ok: false; code: "not_found" | "module_not_installed" | "conflict" | "internal_error"; message: string };

/**
 * Garante uma linha em `avaliacao_avaliacoes` ligada ao agendamento e grava
 * `evaluation_record_id`. Idempotente: se o ponteiro já existe, devolve-o.
 */
export async function garantirAvaliacaoDoAgendamento(
  db: SupabaseClient,
  params: {
    organizationId: string;
    agendamentoId: string;
    actorUserId: string;
  },
): Promise<ResultadoCriarDaAgenda> {
  const { data: ag, error: agErr } = await db
    .from("avaliacao_agendamentos")
    .select(
      "id, organization_id, contact_id, unit_id, consultant_user_id, attendant_user_id, client_email, vehicle_plate, vehicle_brand, vehicle_model, evaluation_record_id, status",
    )
    .eq("id", params.agendamentoId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (agErr) {
    if (moduloAvaliacaoNaoInstalado(agErr)) {
      return { ok: false, code: "module_not_installed", message: agErr.message };
    }
    return { ok: false, code: "internal_error", message: agErr.message };
  }
  if (!ag) return { ok: false, code: "not_found", message: "Agendamento não encontrado." };

  if (ag.evaluation_record_id) {
    return { ok: true, avaliacao_id: ag.evaluation_record_id as string, criada: false };
  }

  const { data: existente } = await db
    .from("avaliacao_avaliacoes")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("agendamento_id", params.agendamentoId)
    .maybeSingle();

  if (existente?.id) {
    await db
      .from("avaliacao_agendamentos")
      .update({ evaluation_record_id: existente.id, updated_at: new Date().toISOString() })
      .eq("id", params.agendamentoId)
      .eq("organization_id", params.organizationId);
    return { ok: true, avaliacao_id: existente.id as string, criada: false };
  }

  const { data: criada, error: insErr } = await db
    .from("avaliacao_avaliacoes")
    .insert({
      organization_id: params.organizationId,
      contact_id: ag.contact_id,
      unit_id: ag.unit_id,
      consultant_user_id: ag.consultant_user_id,
      attendant_user_id: ag.attendant_user_id ?? params.actorUserId,
      agendamento_id: params.agendamentoId,
      tipo: "propria",
      status_laudo: "incompleta",
      cliente_responsaveis: {
        email: ag.client_email ?? undefined,
      },
      veiculo: {
        placa: ag.vehicle_plate ?? undefined,
        marca: ag.vehicle_brand ?? undefined,
        modelo: ag.vehicle_model ?? undefined,
      },
    })
    .select("id")
    .single();

  if (insErr || !criada) {
    if (moduloAvaliacaoNaoInstalado(insErr)) {
      return { ok: false, code: "module_not_installed", message: insErr?.message ?? "módulo" };
    }
    return { ok: false, code: "internal_error", message: insErr?.message ?? "falha ao criar avaliação" };
  }

  const { error: linkErr } = await db
    .from("avaliacao_agendamentos")
    .update({ evaluation_record_id: criada.id, updated_at: new Date().toISOString() })
    .eq("id", params.agendamentoId)
    .eq("organization_id", params.organizationId);

  if (linkErr) {
    return { ok: false, code: "internal_error", message: linkErr.message };
  }

  return { ok: true, avaliacao_id: criada.id as string, criada: true };
}
