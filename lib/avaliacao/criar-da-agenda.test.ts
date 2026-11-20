import { describe, expect, it, vi } from "vitest";

import { garantirAvaliacaoDoAgendamento } from "./criar-da-agenda";

function encadear(resultado: { data: unknown; error: unknown }) {
  const fim = {
    maybeSingle: async () => resultado,
    single: async () => resultado,
  };
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: fim.maybeSingle,
          single: fim.single,
        }),
        maybeSingle: fim.maybeSingle,
        single: fim.single,
      }),
    }),
    insert: () => ({
      select: () => ({
        single: fim.single,
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
  };
}

describe("garantirAvaliacaoDoAgendamento", () => {
  it("reusa evaluation_record_id quando o agendamento já aponta", async () => {
    const from = vi.fn((tabela: string) => {
      expect(tabela).toBe("avaliacao_agendamentos");
      return encadear({
        data: {
          id: "ag-1",
          organization_id: "org-1",
          contact_id: "c-1",
          unit_id: "u-1",
          consultant_user_id: null,
          attendant_user_id: null,
          client_email: null,
          vehicle_plate: "ABC1D23",
          vehicle_brand: "Fiat",
          vehicle_model: "Argo",
          evaluation_record_id: "av-existente",
          status: "em_avaliacao",
        },
        error: null,
      });
    });

    const out = await garantirAvaliacaoDoAgendamento(
      { from } as never,
      { organizationId: "org-1", agendamentoId: "ag-1", actorUserId: "user-1" },
    );

    expect(out).toEqual({ ok: true, avaliacao_id: "av-existente", criada: false });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("cria a ficha e grava o ponteiro quando ainda não existe", async () => {
    let passo = 0;
    const update = vi.fn(() => ({
      eq: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }));
    const from = vi.fn((tabela: string) => {
      passo += 1;
      if (passo === 1) {
        expect(tabela).toBe("avaliacao_agendamentos");
        return encadear({
          data: {
            id: "ag-1",
            organization_id: "org-1",
            contact_id: "c-1",
            unit_id: "u-1",
            consultant_user_id: "cons-1",
            attendant_user_id: null,
            client_email: "a@b.com",
            vehicle_plate: "ABC1D23",
            vehicle_brand: "Fiat",
            vehicle_model: "Argo",
            evaluation_record_id: null,
            status: "confirmado",
          },
          error: null,
        });
      }
      if (passo === 2) {
        expect(tabela).toBe("avaliacao_avaliacoes");
        return encadear({ data: null, error: null });
      }
      if (passo === 3) {
        expect(tabela).toBe("avaliacao_avaliacoes");
        return {
          insert: (payload: Record<string, unknown>) => {
            expect(payload).toEqual(
              expect.objectContaining({
                organization_id: "org-1",
                agendamento_id: "ag-1",
                contact_id: "c-1",
                unit_id: "u-1",
                attendant_user_id: "user-1",
                status_laudo: "incompleta",
              }),
            );
            return {
              select: () => ({
                single: async () => ({ data: { id: "av-nova" }, error: null }),
              }),
            };
          },
        };
      }
      expect(tabela).toBe("avaliacao_agendamentos");
      return { update };
    });

    const out = await garantirAvaliacaoDoAgendamento(
      { from } as never,
      { organizationId: "org-1", agendamentoId: "ag-1", actorUserId: "user-1" },
    );

    expect(out).toEqual({ ok: true, avaliacao_id: "av-nova", criada: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ evaluation_record_id: "av-nova" }),
    );
  });
});
