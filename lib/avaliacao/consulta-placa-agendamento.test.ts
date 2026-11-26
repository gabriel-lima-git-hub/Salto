import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/types";

import { liberarMarcaModeloAposConsulta } from "./consulta-placa-agendamento";

describe("liberarMarcaModeloAposConsulta", () => {
  it("placa inválida não abre marca e modelo", () => {
    const erro = new ApiError(422, "validation_failed", undefined, "req", "placa inválida");
    expect(liberarMarcaModeloAposConsulta(erro)).toBe(false);
  });

  it("veículo não encontrado abre o preenchimento manual", () => {
    const erro = new ApiError(404, "not_found", undefined, "req", "não encontrado");
    expect(liberarMarcaModeloAposConsulta(erro)).toBe(true);
  });

  it("falha da consulta (timeout, saldo, rede) também abre", () => {
    expect(
      liberarMarcaModeloAposConsulta(
        new ApiError(504, "upstream_unavailable", undefined, "req", "timeout"),
      ),
    ).toBe(true);
    expect(liberarMarcaModeloAposConsulta(new Error("falha de rede"))).toBe(true);
  });
});
