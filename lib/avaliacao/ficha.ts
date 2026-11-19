import { z } from "zod";

export const TIPOS_AVALIACAO = ["propria", "apoio", "repasse"] as const;
export type TipoAvaliacao = (typeof TIPOS_AVALIACAO)[number];

export const STATUS_LAUDO = ["aprovado", "apontamento", "reprovado", "incompleta"] as const;
export type StatusLaudo = (typeof STATUS_LAUDO)[number];

export const ROTULO_STATUS_LAUDO: Record<StatusLaudo, string> = {
  aprovado: "Aprovado",
  apontamento: "Apontamento",
  reprovado: "Reprovado",
  incompleta: "Incompleta",
};

export const ETAPAS_COMPLETAS = [
  "veiculo",
  "fotos",
  "historico",
  "estrutura",
  "opcionais",
  "condicao_geral",
  "dinamica",
  "negocio",
] as const;

export const ETAPAS_REPASSE = ["veiculo", "negocio", "fotos"] as const;

export type EtapaAvaliacao = (typeof ETAPAS_COMPLETAS)[number];

export const ROTULO_ETAPA: Record<EtapaAvaliacao, string> = {
  veiculo: "Veículo",
  fotos: "Fotos",
  historico: "Histórico",
  estrutura: "Estrutura",
  opcionais: "Opcionais",
  condicao_geral: "Condição geral",
  dinamica: "Dinâmica",
  negocio: "Negócio",
};

export const MINIMO_DE_FOTOS = 5;
export const BUCKET_AVALIACAO_FOTOS = "avaliacao-fotos";
export const TAMANHO_MAXIMO_FOTO_AVALIACAO = 5 * 1024 * 1024;

const jsonObj = z.record(z.string(), z.unknown()).default({});

export const clienteResponsaveisSchema = z
  .object({
    whatsapp: z.string().trim().max(32).optional(),
    nome: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    proprietario: z
      .enum(["proprio", "parente", "conjuge", "terceiro"])
      .optional()
      .nullable(),
  })
  .passthrough()
  .default({});

export const veiculoSchema = z
  .object({
    placa: z.string().trim().max(16).optional(),
    marca: z.string().trim().max(80).optional(),
    modelo: z.string().trim().max(120).optional(),
    versao: z.string().trim().max(120).optional(),
    ano_fabricacao: z.number().int().min(1950).max(2100).optional().nullable(),
    ano_modelo: z.number().int().min(1950).max(2100).optional().nullable(),
    cambio: z.string().trim().max(40).optional(),
    combustivel: z.string().trim().max(40).optional(),
    km_atual: z.number().int().min(0).optional().nullable(),
    km_compra: z.number().int().min(0).optional().nullable(),
    km_compra_nao_sabe: z.boolean().optional(),
    debitos: z.string().trim().max(2000).optional(),
    financiamento: z.string().trim().max(2000).optional(),
  })
  .passthrough()
  .default({});

export const historicoSchema = z
  .object({
    leilao: z
      .enum(["sem_historico", "pequena_monta", "media_monta", "financeira"])
      .optional()
      .nullable(),
    observacoes: z.string().trim().max(4000).optional(),
  })
  .passthrough()
  .default({});

export const estruturaSchema = z
  .object({
    laudo: z.enum(["aprovado", "apontamentos", "reprovado"]).optional().nullable(),
    observacoes: z.string().trim().max(4000).optional(),
  })
  .passthrough()
  .default({});

export const negocioSchema = z
  .object({
    valor_fipe_cents: z.number().int().min(0).optional().nullable(),
    valor_pretendido_cents: z.number().int().min(0).optional().nullable(),
    debitos_cents: z.number().int().min(0).optional().nullable(),
    quitacao_cents: z.number().int().min(0).optional().nullable(),
    gastos: z.array(z.object({ descricao: z.string().max(200), valor_cents: z.number().int().min(0) })).optional(),
  })
  .passthrough()
  .default({});

export const criarAvaliacaoSchema = z
  .object({
    contact_id: z.string().uuid().optional(),
    client_name: z.string().trim().min(1).max(200).optional(),
    client_phone: z.string().trim().min(8).max(32).optional(),
    client_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    unit_id: z.string().uuid(),
    consultant_user_id: z.string().uuid().nullable().optional(),
    attendant_user_id: z.string().uuid().nullable().optional(),
    agendamento_id: z.string().uuid().optional(),
    tipo: z.enum(TIPOS_AVALIACAO).default("propria"),
    origem_lead: z.string().trim().max(120).optional().nullable(),
    avaliadores: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    veiculo: veiculoSchema.optional(),
    cliente_responsaveis: clienteResponsaveisSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.contact_id && (!v.client_name || !v.client_phone)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o contato existente ou nome e WhatsApp do cliente.",
      });
    }
  });

export const atualizarAvaliacaoSchema = z
  .object({
    tipo: z.enum(TIPOS_AVALIACAO).optional(),
    origem_lead: z.string().trim().max(120).nullable().optional(),
    avaliadores: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    consultant_user_id: z.string().uuid().nullable().optional(),
    attendant_user_id: z.string().uuid().nullable().optional(),
    unit_id: z.string().uuid().optional(),
    cliente_responsaveis: clienteResponsaveisSchema.optional(),
    veiculo: veiculoSchema.optional(),
    historico: historicoSchema.optional(),
    estrutura: estruturaSchema.optional(),
    opcionais: jsonObj.optional(),
    condicao_geral: jsonObj.optional(),
    dinamica: jsonObj.optional(),
    negocio: negocioSchema.optional(),
    /** `null` reabre a ficha (Retomar). */
    concluida_at: z.null().optional(),
    status_laudo: z.enum(STATUS_LAUDO).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar." });

export const listarAvaliacoesSchema = z.object({
  unit_id: z.string().uuid().optional(),
  consultant_user_id: z.string().uuid().optional(),
  de: z.string().datetime({ offset: true }).optional(),
  ate: z.string().datetime({ offset: true }).optional(),
  aba: z.enum(["todas", "concluido", "incompleta"]).default("todas"),
  q: z.string().trim().max(120).optional(),
});

export const concluirAvaliacaoSchema = z.object({
  status_laudo: z.enum(["aprovado", "apontamento", "reprovado"]),
});

const FORMA_ARQUIVO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function fotoPertenceAAvaliacao(caminho: string, orgId: string, avaliacaoId: string): boolean {
  const prefixo = `${orgId}/${avaliacaoId}/`;
  return caminho.startsWith(prefixo) && FORMA_ARQUIVO.test(caminho.slice(prefixo.length));
}

/** Campos mínimos do bloco Veículo para concluir (doc Avaliasys). */
export function veiculoProntoParaConcluir(veiculo: unknown, cliente: unknown): string | null {
  const v = veiculoSchema.safeParse(veiculo);
  const c = clienteResponsaveisSchema.safeParse(cliente);
  if (!v.success || !c.success) return "Dados do veículo inválidos.";
  if (!c.data.nome?.trim() && !c.data.whatsapp?.trim()) {
    return "Informe nome ou WhatsApp do cliente.";
  }
  if (!v.data.placa?.trim()) return "Informe a placa do veículo.";
  if (!v.data.marca?.trim() || !v.data.modelo?.trim()) return "Informe marca e modelo.";
  return null;
}
