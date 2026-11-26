import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { createApiBrasilVeiculoClient } from "@/lib/apibrasil/consulta-veiculo";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  placa: z.string().trim().min(7).max(16),
});

const LIMITE_POR_MINUTO = 20;

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) {
    return fail("not_found", "Not found", 404, { requestId });
  }

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_agendamentos" });
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("validation_failed", "JSON inválido.", 422, { requestId });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("validation_failed", "Informe uma placa válida.", 422, { requestId });
  }

  const orgId = authz.org.orgId;
  const limite = await checkRateLimit(`avaliacao-placa:${orgId}`, LIMITE_POR_MINUTO, 60);
  if (!limite.allowed) {
    return fail("rate_limited", "Muitas consultas de placa. Aguarde um minuto.", 429, {
      requestId,
      headers: { "Retry-After": "60" },
    });
  }

  const client = createApiBrasilVeiculoClient();
  const resultado = await client.consultarPlaca(parsed.data.placa);

  if (!resultado.ok) {
    switch (resultado.code) {
      case "token_ausente":
        return fail("upstream_unavailable", resultado.message, 503, { requestId });
      case "placa_invalida":
        return fail("validation_failed", resultado.message, 422, { requestId });
      case "not_found":
        return fail("not_found", resultado.message, 404, { requestId });
      case "saldo_insuficiente":
        return fail("upstream_unavailable", resultado.message, 402, { requestId });
      case "timeout":
        return fail("upstream_unavailable", resultado.message, 504, { requestId });
      default:
        return fail("upstream_unavailable", resultado.message, 502, { requestId });
    }
  }

  void audit({
    action: "avaliacao.placa_consultada",
    resourceType: "avaliacao_veiculo",
    // Placa não é uuid — a coluna resource_id estoura o INSERT se receber chave natural.
    resourceId: null,
    organizationId: orgId,
    actorUserId: authz.user.id,
    requestId,
    metadata: {
      placa: resultado.data.placa,
      marca: resultado.data.marca,
      modelo: resultado.data.modelo,
    },
  });

  return ok({ veiculo: resultado.data }, { requestId });
}
