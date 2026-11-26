import { z } from "zod";

import { normalizarPlaca } from "@/lib/apibrasil/mapear-veiculo";

import { normalizarCnpjUnidade } from "./cnpj-unidade";
import { STATUS_AVALIACAO } from "./status";

const MENSAGEM_PLACA = "Informe uma placa válida (ex.: ABC1D23 ou ABC1234).";

/** Ausente no PATCH. No POST, o superRefine exige uma placa que passe daqui. */
const placaCampo = z
  .string()
  .trim()
  .max(16)
  .refine((v) => normalizarPlaca(v) !== null, { message: MENSAGEM_PLACA })
  .transform((v) => normalizarPlaca(v) as string)
  .optional();

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v));

const cnpjCampo = z
  .string()
  .trim()
  .min(1, "CNPJ é obrigatório.")
  .transform((v, ctx) => {
    const n = normalizarCnpjUnidade(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "CNPJ inválido." });
      return z.NEVER;
    }
    return n;
  });

const agendamentoCorpoSchema = z.object({
  contact_id: z.string().uuid().optional(),
  client_name: z.string().trim().min(1).max(200).optional(),
  client_phone: z.string().trim().min(8).max(32).optional(),
  client_email: z.string().trim().email().max(200).optional().or(z.literal("")),
  unit_id: z.string().uuid(),
  consultant_user_id: z.string().uuid().nullable().optional(),
  consultant_auto: z.boolean().optional(),
  attendant_user_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().min(20).max(120).default(20),
  vehicle_plate: placaCampo,
  vehicle_brand: z.string().trim().max(80).optional(),
  vehicle_model: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  lead_id: z.string().uuid().optional(),
});

export const criarAgendamentoSchema = agendamentoCorpoSchema.superRefine((v, ctx) => {
  if (!v.contact_id && (!v.client_name || !v.client_phone)) {
    ctx.addIssue({
      code: "custom",
      message: "Informe o contato existente ou nome e WhatsApp do cliente.",
    });
  }
  if (!v.vehicle_plate) {
    ctx.addIssue({
      code: "custom",
      message: MENSAGEM_PLACA,
      path: ["vehicle_plate"],
    });
  }
});

/**
 * Campos só de criação (resolução de contato / distribuição). Não existem em
 * `avaliacao_agendamentos` — se entrarem no `.update()`, o PostgREST responde
 * `PGRST204` ("Could not find the 'consultant_auto' column…") e a edição falha
 * depois do formulário ter enviado o mesmo corpo do POST.
 *
 * No Zod 4, `.partial()` **mantém** `.default()` de cada campo. Sem
 * `removeDefault()` em `duration_minutes`, `safeParse({})` devolve
 * `{ duration_minutes: 20 }` e o `.refine` de corpo vazio passa — e o PATCH
 * regravaria a duração que o cliente nem mandou (mesmo defeito de
 * `agentConfigPatchSchema` em `lib/ai/guardrails-schema.ts`).
 */
const corpoParaPatch = agendamentoCorpoSchema.omit({
  client_name: true,
  client_phone: true,
  consultant_auto: true,
});

export const atualizarAgendamentoSchema = corpoParaPatch
  .extend({
    duration_minutes: corpoParaPatch.shape.duration_minutes.removeDefault(),
    status: z.enum(STATUS_AVALIACAO).optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar." });

export const listarAgendamentosSchema = z.object({
  de: z.string().datetime({ offset: true }),
  ate: z.string().datetime({ offset: true }),
  status: z.enum(STATUS_AVALIACAO).optional(),
  unit_id: z.string().uuid().optional(),
  consultant_user_id: z.string().uuid().optional(),
  attendant_user_id: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
});

export const unidadeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cnpj: cnpjCampo,
  internal_code: textoOpcional(64),
  employee_count: z.number().int().min(0).max(1_000_000).nullable().optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
  is_active: z.boolean().optional(),
  cep: textoOpcional(16),
  state: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF inválida.")
      .nullable()
      .optional(),
  ),
  city: textoOpcional(120),
  neighborhood: textoOpcional(120),
  street: textoOpcional(200),
  number: textoOpcional(32),
  complement: textoOpcional(120),
  phone: textoOpcional(32),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("E-mail inválido.").max(200).nullable().optional(),
  ),
  responsible_name: textoOpcional(200),
  notes: textoOpcional(4000),
});

/**
 * PATCH: CNPJ opcional (pode completar unidade legada). Demais campos iguais.
 * No Zod 4, `.partial()` sozinho deixa `cnpj` obrigatório se não reescrevermos.
 */
export const atualizarUnidadeSchema = unidadeSchema
  .omit({ cnpj: true })
  .extend({
    cnpj: cnpjCampo.optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar." });
