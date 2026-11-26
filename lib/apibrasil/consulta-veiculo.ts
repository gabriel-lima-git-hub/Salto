/**
 * Cliente HTTP da API Brasil — consulta veicular por placa (agregados-v2).
 *
 * Só roda no servidor (Bearer em env). Timeout curto; Zod na borda; Result
 * tipado — nunca lança para o handler. A cobrança é por consulta
 * (`homolog: false`); quem chama decide o rate limit e a auditoria.
 */
import { z } from "zod";

import {
  dataVeiculoApiSchema,
  mapearVeiculoDaApiBrasil,
  normalizarPlaca,
  type VeiculoConsultado,
} from "@/lib/apibrasil/mapear-veiculo";
import { env } from "@/lib/env";

export type {
  VeiculoConsultado,
} from "@/lib/apibrasil/mapear-veiculo";
export {
  extrairVersao,
  flagsCatalogoParaUi,
  mapearVeiculoDaApiBrasil,
  normalizarPlaca,
} from "@/lib/apibrasil/mapear-veiculo";

const DEFAULT_BASE = "https://gateway.apibrasil.io/api/v2";
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = "self-hosted-crm/1.0";

export type ConsultaVeiculoErroCode =
  | "token_ausente"
  | "placa_invalida"
  | "not_found"
  | "timeout"
  | "upstream_error"
  | "saldo_insuficiente"
  | "incomplete";

export type ConsultaVeiculoResult =
  | { ok: true; data: VeiculoConsultado; raw: unknown }
  | {
      ok: false;
      code: ConsultaVeiculoErroCode;
      message: string;
      status?: number;
    };

const respostaSchema = z
  .object({
    error: z.boolean().optional(),
    message: z.string().optional().nullable(),
    status_code: z.number().optional().nullable(),
    data: dataVeiculoApiSchema.optional().nullable(),
  })
  .passthrough();

export interface ApiBrasilVeiculoClientOpts {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface ApiBrasilVeiculoClient {
  consultarPlaca(placaBruta: string): Promise<ConsultaVeiculoResult>;
}

export function createApiBrasilVeiculoClient(
  opts: ApiBrasilVeiculoClientOpts = {},
): ApiBrasilVeiculoClient {
  const token = (opts.token ?? env.APIBRASIL_BEARER_TOKEN).trim();
  const baseConfigurada = (opts.baseUrl ?? env.APIBRASIL_BASE_URL).trim();
  const baseUrl = (baseConfigurada || DEFAULT_BASE).replace(/\/$/, "");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = opts.fetchFn ?? fetch;

  return {
    async consultarPlaca(placaBruta: string): Promise<ConsultaVeiculoResult> {
      if (!token) {
        return {
          ok: false,
          code: "token_ausente",
          message:
            "Consulta de placa não configurada nesta instalação. Peça ao administrador para definir APIBRASIL_BEARER_TOKEN.",
        };
      }

      const placa = normalizarPlaca(placaBruta);
      if (!placa) {
        return {
          ok: false,
          code: "placa_invalida",
          message: "Informe uma placa válida (ex.: ABC1D23 ou ABC1234).",
        };
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchFn(`${baseUrl}/consulta/veiculos/credits`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": USER_AGENT,
          },
          body: JSON.stringify({
            tipo: "agregados-v2",
            placa,
            homolog: false,
          }),
          signal: ctrl.signal,
        });

        let raw: unknown;
        try {
          raw = await res.json();
        } catch {
          return {
            ok: false,
            code: "upstream_error",
            message: `API Brasil respondeu ${res.status} sem JSON.`,
            status: res.status,
          };
        }

        const parsed = respostaSchema.safeParse(raw);
        if (!parsed.success) {
          return {
            ok: false,
            code: "incomplete",
            message: "Resposta da API Brasil incompleta ou inválida.",
            status: res.status,
          };
        }

        const body = parsed.data;
        const msg = (body.message ?? "").toLowerCase();
        if (
          res.status === 402 ||
          /saldo|crédito|credito|insufficient|sem saldo|sem credito/.test(msg)
        ) {
          return {
            ok: false,
            code: "saldo_insuficiente",
            message: body.message?.trim() || "Saldo insuficiente na API Brasil.",
            status: res.status,
          };
        }

        // A API Brasil sinaliza falha no corpo com HTTP 200 (`error: true`).
        if (body.error === true || (body.status_code != null && body.status_code >= 400)) {
          const notFound =
            res.status === 404 ||
            body.status_code === 404 ||
            /não encontr|nao encontr|not found|placa.?inválid|placa.?invalid/i.test(
              body.message ?? "",
            );
          return {
            ok: false,
            code: notFound ? "not_found" : "upstream_error",
            message: body.message?.trim() || "Consulta de placa recusada pela API Brasil.",
            status: body.status_code ?? res.status,
          };
        }

        if (!res.ok) {
          return {
            ok: false,
            code: res.status === 404 ? "not_found" : "upstream_error",
            message: body.message?.trim() || `API Brasil respondeu ${res.status}.`,
            status: res.status,
          };
        }

        if (!body.data) {
          return {
            ok: false,
            code: "not_found",
            message: body.message?.trim() || "Veículo não encontrado para esta placa.",
            status: res.status,
          };
        }

        const mapped = mapearVeiculoDaApiBrasil(body.data, placa);
        if (!mapped) {
          return {
            ok: false,
            code: "incomplete",
            message: "API Brasil sem marca/modelo utilizáveis.",
            status: res.status,
          };
        }

        return { ok: true, data: mapped, raw };
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          code: aborted ? "timeout" : "upstream_error",
          message: aborted
            ? "Timeout ao consultar a placa."
            : "Falha de rede ao consultar a API Brasil.",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
