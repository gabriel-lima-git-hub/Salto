import { describe, expect, it, vi } from "vitest";

import { createApiBrasilVeiculoClient } from "./consulta-veiculo";
import { extrairVersao, mapearVeiculoDaApiBrasil, normalizarPlaca } from "./mapear-veiculo";

const PAYLOAD_EXEMPLO = {
  anoFabricacao: "2019",
  anoModelo: "2020",
  caixaCambio: "Automatica",
  combustivel: "FLEX",
  familia: "TRACKER",
  marca: "CHEVROLET",
  marcaModelo: "GM/TRACKER LTZ",
  modelo: "TRACKER",
  placa: "ABC1234",
};

describe("normalizarPlaca", () => {
  it("aceita antiga e Mercosul, remove hífen", () => {
    expect(normalizarPlaca("abc-1234")).toBe("ABC1234");
    expect(normalizarPlaca("ABC1D23")).toBe("ABC1D23");
    expect(normalizarPlaca("abc 1d23")).toBe("ABC1D23");
  });

  it("recusa formato inválido", () => {
    expect(normalizarPlaca("AB1234")).toBeNull();
    expect(normalizarPlaca("")).toBeNull();
    expect(normalizarPlaca("ABCD123")).toBeNull();
  });
});

describe("extrairVersao / mapearVeiculoDaApiBrasil", () => {
  it("extrai versão de marcaModelo", () => {
    expect(extrairVersao("GM/TRACKER LTZ", "TRACKER")).toBe("LTZ");
    expect(extrairVersao("GM/TRACKER", "TRACKER", "TRACKER")).toBeUndefined();
  });

  it("mapeia o payload de exemplo da documentação", () => {
    const v = mapearVeiculoDaApiBrasil(PAYLOAD_EXEMPLO, "ABC1234");
    expect(v).toMatchObject({
      placa: "ABC1234",
      modelo: expect.stringMatching(/tracker/i),
      versao: "LTZ",
      ano_fabricacao: 2019,
      ano_modelo: 2020,
      cambio: "Automatica",
      combustivel: "FLEX",
    });
    expect(v?.marca.toLowerCase()).toBe("chevrolet");
  });

  it("sem marca nem modelo → null", () => {
    expect(mapearVeiculoDaApiBrasil({}, "ABC1234")).toBeNull();
  });
});

describe("createApiBrasilVeiculoClient", () => {
  it("token vazio → token_ausente sem fetch", async () => {
    const fetchFn = vi.fn();
    const client = createApiBrasilVeiculoClient({ token: "", fetchFn });
    const r = await client.consultarPlaca("ABC1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("token_ausente");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("placa inválida → placa_invalida sem fetch", async () => {
    const fetchFn = vi.fn();
    const client = createApiBrasilVeiculoClient({ token: "tok", fetchFn });
    const r = await client.consultarPlaca("XX");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("placa_invalida");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sucesso com payload de homologação", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        error: false,
        status_code: 200,
        message: "ok",
        data: PAYLOAD_EXEMPLO,
      }),
    );
    const client = createApiBrasilVeiculoClient({
      token: "tok",
      baseUrl: "https://gateway.example/api/v2",
      fetchFn,
    });
    const r = await client.consultarPlaca("abc-1234");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placa).toBe("ABC1234");
      expect(r.data.ano_modelo).toBe(2020);
    }
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("/consulta/veiculos/credits");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      tipo: "agregados-v2",
      placa: "ABC1234",
      homolog: false,
    });
  });

  it("error:true no corpo com HTTP 200 → upstream_error/not_found", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ error: true, status_code: 404, message: "Placa não encontrada" }),
    );
    const client = createApiBrasilVeiculoClient({ token: "tok", fetchFn });
    const r = await client.consultarPlaca("ABC1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_found");
  });

  it("AbortError → timeout", async () => {
    const fetchFn = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const client = createApiBrasilVeiculoClient({ token: "tok", fetchFn, timeoutMs: 1 });
    const r = await client.consultarPlaca("ABC1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("timeout");
  });
});
