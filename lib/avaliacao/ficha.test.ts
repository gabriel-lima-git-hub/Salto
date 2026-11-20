import { describe, expect, it } from "vitest";

import {
  atualizarAvaliacaoSchema,
  concluirAvaliacaoSchema,
  fotoPertenceAAvaliacao,
  MINIMO_DE_FOTOS,
  veiculoProntoParaConcluir,
} from "./ficha";

describe("ficha de avaliação", () => {
  it("exige pelo menos 5 fotos na regra do produto", () => {
    expect(MINIMO_DE_FOTOS).toBe(5);
  });

  it("concluir sem 5 fotos falha na régua do produto", () => {
    const fotosEnviadas = 4;
    expect(fotosEnviadas < MINIMO_DE_FOTOS).toBe(true);
    expect(
      `Envie pelo menos ${MINIMO_DE_FOTOS} fotos para concluir a avaliação.`,
    ).toMatch(/5 fotos/);
  });


  it("aceita reabrir com concluida_at null", () => {
    const r = atualizarAvaliacaoSchema.safeParse({
      concluida_at: null,
      status_laudo: "incompleta",
    });
    expect(r.success).toBe(true);
  });

  it("concluir só aceita laudo final", () => {
    expect(concluirAvaliacaoSchema.safeParse({ status_laudo: "aprovado" }).success).toBe(true);
    expect(concluirAvaliacaoSchema.safeParse({ status_laudo: "incompleta" }).success).toBe(false);
  });

  it("veiculoProntoParaConcluir exige placa e cliente", () => {
    expect(veiculoProntoParaConcluir({}, {})).toMatch(/nome|WhatsApp/i);
    expect(
      veiculoProntoParaConcluir({ placa: "ABC1D23" }, { nome: "Ana" }),
    ).toMatch(/marca/i);
    expect(
      veiculoProntoParaConcluir(
        { placa: "ABC1D23", marca: "Fiat", modelo: "Argo" },
        { nome: "Ana" },
      ),
    ).toBeNull();
  });

  it("fotoPertenceAAvaliacao só aceita caminho da org/avaliação", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const av = "22222222-2222-4222-8222-222222222222";
    const ok = `${org}/${av}/33333333-3333-4333-8333-333333333333.jpg`;
    expect(fotoPertenceAAvaliacao(ok, org, av)).toBe(true);
    expect(fotoPertenceAAvaliacao(`${org}/outra/x.jpg`, org, av)).toBe(false);
  });
});
