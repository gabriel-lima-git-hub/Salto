import { describe, expect, it } from "vitest";

import {
  ehMarcaDoCatalogo,
  ehModeloDoCatalogo,
  marcaCanonica,
  modelosDaMarca,
  MARCAS_CATALOGO,
} from "./catalogo-veiculos";

describe("catalogo-veiculos", () => {
  it("tem marcas suficientes e ordenadas", () => {
    expect(MARCAS_CATALOGO.length).toBeGreaterThanOrEqual(80);
    expect(MARCAS_CATALOGO).not.toContain("Outra");
    const ordenado = [...MARCAS_CATALOGO].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect([...MARCAS_CATALOGO]).toEqual(ordenado);
  });

  it("reconhece marca/modelo do catálogo e o escape manual", () => {
    expect(ehMarcaDoCatalogo("Volkswagen")).toBe(true);
    expect(ehMarcaDoCatalogo("volkswagen")).toBe(true);
    expect(ehMarcaDoCatalogo("Marca Inventada")).toBe(false);

    expect(modelosDaMarca("Fiat")).toContain("Argo");
    expect(ehModeloDoCatalogo("Fiat", "Argo")).toBe(true);
    expect(ehModeloDoCatalogo("Fiat", "Modelo X")).toBe(false);
    expect(ehModeloDoCatalogo("Marca Inventada", "Qualquer")).toBe(false);
  });

  it("marcaCanonica preserva grafia do catálogo", () => {
    expect(marcaCanonica("jeep")).toBe("Jeep");
    expect(marcaCanonica("Custom")).toBe("Custom");
  });
});
