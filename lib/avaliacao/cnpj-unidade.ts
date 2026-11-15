import { isValidCnpj } from "@/lib/cobranca/documento";

const SEPARADORES = /[.\-/\s]/g;

/** Normaliza CNPJ para 14 caracteres (Receita) ou `null` se inválido. */
export function normalizarCnpjUnidade(bruto: string): string | null {
  const s = bruto.replace(SEPARADORES, "").toUpperCase();
  if (!isValidCnpj(s)) return null;
  return s;
}

/** Máscara 00.000.000/0000-00 para exibição (só dígitos clássicos). */
export function formatarCnpjUnidade(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const s = cnpj.replace(SEPARADORES, "");
  if (!/^\d{14}$/.test(s)) return cnpj;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}
