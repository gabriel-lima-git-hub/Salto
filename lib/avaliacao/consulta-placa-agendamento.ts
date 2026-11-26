import { ApiError } from "@/lib/api/types";

/**
 * Marca e modelo do agendamento só abrem para digitação quando a consulta
 * não devolve o veículo. Placa inválida não libera: a pessoa corrige a placa
 * e consulta de novo.
 */
export function liberarMarcaModeloAposConsulta(erro: unknown): boolean {
  if (erro instanceof ApiError && erro.code === "validation_failed") return false;
  return true;
}
