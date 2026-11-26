/**
 * POST /api/v1/avaliacao/veiculos/consulta-placa
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import type { AuthUser } from "@/lib/auth/types";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { createApiBrasilVeiculoClient } from "@/lib/apibrasil/consulta-veiculo";
import { audit } from "@/lib/audit";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/instalacao/modulos", () => ({ moduloLigado: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/apibrasil/consulta-veiculo", () => ({
  createApiBrasilVeiculoClient: vi.fn(),
}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function usuario(): AuthUser {
  return {
    id: USER_ID,
    email: "a@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    idioma: "pt-BR",
    organizations: [{ organization_id: ORG_ID, organization_name: "Org", role: "agent" }],
  } as AuthUser;
}

function autorizado(): void {
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: usuario(),
    org: { orgId: ORG_ID, name: "Org", role: "agent" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue({} as never);
  vi.mocked(moduloLigado).mockResolvedValue(true);
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    count: 1,
    limit: 20,
    window_sec: 60,
  } as never);
});

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/avaliacao/veiculos/consulta-placa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/avaliacao/veiculos/consulta-placa", () => {
  it("módulo desligado → 404", async () => {
    vi.mocked(moduloLigado).mockResolvedValue(false);
    const { POST } = await import("./route");
    const res = await POST(req({ placa: "ABC1234" }));
    expect(res.status).toBe(404);
  });

  it("papel insuficiente → 403", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: fail("forbidden_role", "Papel insuficiente.", 403, {}),
    } as never);
    const { POST } = await import("./route");
    expect((await POST(req({ placa: "ABC1234" }))).status).toBe(403);
  });

  it("rate limit → 429", async () => {
    autorizado();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      count: 21,
      limit: 20,
      window_sec: 60,
    } as never);
    const { POST } = await import("./route");
    const res = await POST(req({ placa: "ABC1234" }));
    expect(res.status).toBe(429);
  });

  it("sucesso → 200 + audit", async () => {
    autorizado();
    const consultarPlaca = vi.fn(async () => ({
      ok: true as const,
      data: {
        placa: "ABC1234",
        marca: "Chevrolet",
        modelo: "Tracker",
        ano_modelo: 2020,
      },
      raw: {},
    }));
    vi.mocked(createApiBrasilVeiculoClient).mockReturnValue({ consultarPlaca } as never);

    const { POST } = await import("./route");
    const res = await POST(req({ placa: "ABC-1234" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.veiculo.placa).toBe("ABC1234");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "avaliacao.placa_consultada",
        organizationId: ORG_ID,
      }),
    );
  });

  it("token ausente → 503", async () => {
    autorizado();
    vi.mocked(createApiBrasilVeiculoClient).mockReturnValue({
      consultarPlaca: async () => ({
        ok: false as const,
        code: "token_ausente" as const,
        message: "não configurada",
      }),
    } as never);
    const { POST } = await import("./route");
    expect((await POST(req({ placa: "ABC1234" }))).status).toBe(503);
  });

  it("placa inválida no cliente → 422", async () => {
    autorizado();
    vi.mocked(createApiBrasilVeiculoClient).mockReturnValue({
      consultarPlaca: async () => ({
        ok: false as const,
        code: "placa_invalida" as const,
        message: "Informe uma placa válida",
      }),
    } as never);
    const { POST } = await import("./route");
    expect((await POST(req({ placa: "ABC1234" }))).status).toBe(422);
  });
});
