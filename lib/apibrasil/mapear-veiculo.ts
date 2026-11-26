/**
 * Normalização e mapeamento puros da consulta de placa (sem I/O, sem env).
 * Seguro para import em componentes client.
 */
import { z } from "zod";

import {
  ehMarcaDoCatalogo,
  ehModeloDoCatalogo,
  marcaCanonica,
  modelosDaMarca,
} from "@/lib/avaliacao/catalogo-veiculos";

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23), sem hífen. */
const PLACA_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export type VeiculoConsultado = {
  placa: string;
  marca: string;
  modelo: string;
  versao?: string;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  cambio?: string;
  combustivel?: string;
};

export const dataVeiculoApiSchema = z
  .object({
    placa: z.string().optional().nullable(),
    marca: z.string().optional().nullable(),
    modelo: z.string().optional().nullable(),
    marcaModelo: z.string().optional().nullable(),
    familia: z.string().optional().nullable(),
    anoFabricacao: z.union([z.string(), z.number()]).optional().nullable(),
    anoModelo: z.union([z.string(), z.number()]).optional().nullable(),
    caixaCambio: z.string().optional().nullable(),
    combustivel: z.string().optional().nullable(),
  })
  .passthrough();

export function normalizarPlaca(bruto: string): string | null {
  const s = bruto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!PLACA_RE.test(s)) return null;
  return s;
}

function anoDe(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n < 1950 || n > 2100) return null;
  return n;
}

function modeloCanonico(marca: string, modelo: string): string {
  const lista = modelosDaMarca(marca);
  const hit = lista.find((x) => x.toLowerCase() === modelo.toLowerCase());
  return hit ?? modelo;
}

/**
 * Tenta extrair a versão de `marcaModelo` (ex.: "GM/TRACKER LTZ" + modelo
 * "TRACKER" → "LTZ"). Sem sobra útil, cai em `familia` se distinta do modelo.
 */
export function extrairVersao(
  marcaModelo: string | null | undefined,
  modelo: string | null | undefined,
  familia?: string | null,
): string | undefined {
  const mm = marcaModelo?.trim();
  const mod = modelo?.trim();
  if (mm && mod) {
    const idx = mm.toUpperCase().lastIndexOf(mod.toUpperCase());
    if (idx >= 0) {
      const after = mm
        .slice(idx + mod.length)
        .replace(/^[\s/\-]+/, "")
        .trim();
      if (after) return after;
    }
  }
  const fam = familia?.trim();
  if (fam && (!mod || fam.toLowerCase() !== mod.toLowerCase())) return fam;
  return undefined;
}

export function mapearVeiculoDaApiBrasil(
  data: z.infer<typeof dataVeiculoApiSchema>,
  placaNormalizada: string,
): VeiculoConsultado | null {
  const marcaBruta = (data.marca ?? "").trim();
  let modeloBruto = (data.modelo ?? "").trim();
  if (!modeloBruto && data.marcaModelo) {
    const mm = data.marcaModelo.trim();
    const aposBarra = mm.includes("/") ? mm.split("/").slice(1).join("/").trim() : mm;
    modeloBruto = aposBarra.split(/\s+/)[0] ?? aposBarra;
  }
  if (!marcaBruta && !modeloBruto) return null;

  const marca = marcaCanonica(marcaBruta) ?? marcaBruta;
  const modelo = modeloBruto ? modeloCanonico(marca, modeloBruto) : "";
  const versao = extrairVersao(data.marcaModelo, modelo || modeloBruto, data.familia);

  return {
    placa: (data.placa ? normalizarPlaca(data.placa) : null) ?? placaNormalizada,
    marca,
    modelo,
    ...(versao ? { versao } : {}),
    ano_fabricacao: anoDe(data.anoFabricacao),
    ano_modelo: anoDe(data.anoModelo),
    ...(data.caixaCambio?.trim() ? { cambio: data.caixaCambio.trim() } : {}),
    ...(data.combustivel?.trim() ? { combustivel: data.combustivel.trim() } : {}),
  };
}

/** Ajusta flags de catálogo para a UI do agendamento. */
export function flagsCatalogoParaUi(veiculo: VeiculoConsultado): {
  marcaManual: boolean;
  modeloManual: boolean;
  marca: string;
  modelo: string;
} {
  const brandManual = Boolean(veiculo.marca) && !ehMarcaDoCatalogo(veiculo.marca);
  const marca = brandManual ? veiculo.marca : (marcaCanonica(veiculo.marca) ?? veiculo.marca);
  const modelManual =
    Boolean(veiculo.modelo) && !ehModeloDoCatalogo(brandManual ? null : marca, veiculo.modelo);
  return {
    marca,
    modelo: veiculo.modelo,
    marcaManual: brandManual,
    modeloManual: modelManual || brandManual,
  };
}
