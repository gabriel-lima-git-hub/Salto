import { describe, expect, it } from "vitest";

import { formatarCnpjUnidade, normalizarCnpjUnidade } from "./cnpj-unidade";

describe("cnpj-unidade", () => {
  it("normaliza máscara e rejeita dígito verificador errado", () => {
    expect(normalizarCnpjUnidade("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizarCnpjUnidade("11.222.333/0001-80")).toBeNull();
  });

  it("formata para exibição", () => {
    expect(formatarCnpjUnidade("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpjUnidade(null)).toBe("");
  });
});
