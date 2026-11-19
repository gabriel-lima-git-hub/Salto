"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAvaliacao, useMutacaoAvaliacao } from "@/hooks/avaliacao/useAvaliacoes";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  ETAPAS_COMPLETAS,
  ETAPAS_REPASSE,
  MINIMO_DE_FOTOS,
  ROTULO_ETAPA,
  ROTULO_STATUS_LAUDO,
  type EtapaAvaliacao,
  type StatusLaudo,
} from "@/lib/avaliacao/ficha";

type Foto = { id: string; storage_path: string; sort_order: number; url?: string | null };

export function AssistenteAvaliacaoClient({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { data, isLoading, refetch } = useAvaliacao(id);
  const { salvar, concluir, excluir } = useMutacaoAvaliacao(id);
  const tipo = (data?.tipo as string) || "propria";
  const etapas = useMemo(
    () => (tipo === "repasse" ? ETAPAS_REPASSE : ETAPAS_COMPLETAS),
    [tipo],
  );
  const [etapa, setEtapa] = useState<EtapaAvaliacao>("veiculo");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const concluida = !!data?.concluida_at;

  useEffect(() => {
    if (!etapas.includes(etapa)) setEtapa(etapas[0]!);
  }, [etapas, etapa]);

  useEffect(() => {
    const embutidas = data?.avaliacao_avaliacao_fotos;
    if (Array.isArray(embutidas) && embutidas.length) {
      setFotos(
        [...embutidas]
          .map((f) => f as Foto)
          .sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    void apiClient
      .get<{ data: Foto[] }>(`/api/v1/avaliacao/avaliacoes/${id}/fotos`)
      .then((r) => setFotos(r.data ?? []))
      .catch(() => undefined);
  }, [id, data?.avaliacao_avaliacao_fotos]);

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }

  const veiculo = (data.veiculo ?? {}) as Record<string, unknown>;
  const cliente = (data.cliente_responsaveis ?? {}) as Record<string, unknown>;
  const historico = (data.historico ?? {}) as Record<string, unknown>;
  const estrutura = (data.estrutura ?? {}) as Record<string, unknown>;
  const negocio = (data.negocio ?? {}) as Record<string, unknown>;
  const laudo = (data.status_laudo as StatusLaudo) || "incompleta";

  async function persist(patch: Record<string, unknown>) {
    await salvar.mutateAsync(patch);
    toast.success(t("Salvo."));
    await refetch();
  }

  async function uploadFoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/v1/avaliacao/avaliacoes/${id}/fotos`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      toast.error(t("Não foi possível enviar a foto."));
      return;
    }
    const json = (await res.json()) as { data: Foto };
    setFotos((prev) => [...prev, json.data]);
    toast.success(t("Foto adicionada."));
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6" data-testid="assistente-avaliacao">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/avaliacoes" className="text-xs text-muted-foreground hover:underline">
            ← {t("Avaliações")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {concluida ? t("Ficha do Veículo") : t("Assistente de avaliação")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ROTULO_STATUS_LAUDO[laudo]} ·{" "}
            {typeof veiculo.placa === "string" ? veiculo.placa : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!concluida && (
            <Button
              disabled={concluir.isPending || fotos.length < MINIMO_DE_FOTOS}
              onClick={async () => {
                await concluir.mutateAsync("aprovado");
                toast.success(t("Avaliação concluída."));
                await refetch();
              }}
            >
              {t("Concluir avaliação")}
            </Button>
          )}
          {concluida && (
            <Button
              variant="outline"
              onClick={async () => {
                await persist({ concluida_at: null, status_laudo: "incompleta" });
                toast.success(t("Avaliação reaberta para edição."));
              }}
            >
              {t("Retomar")}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={async () => {
              await excluir.mutateAsync();
              toast.success(t("Avaliação excluída."));
              router.push("/app/avaliacoes");
            }}
          >
            {t("Excluir")}
          </Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {etapas.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEtapa(e)}
            className={`rounded-md px-3 py-1.5 text-xs ${
              etapa === e ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t(ROTULO_ETAPA[e])}
          </button>
        ))}
      </nav>

      <section className="max-w-2xl space-y-3">
        {etapa === "veiculo" && (
          <>
            <Campo
              label={t("Nome")}
              value={String(cliente.nome ?? "")}
              disabled={concluida}
              onChange={(v) =>
                void persist({ cliente_responsaveis: { ...cliente, nome: v } })
              }
            />
            <Campo
              label={t("WhatsApp")}
              value={String(cliente.whatsapp ?? "")}
              disabled={concluida}
              onChange={(v) =>
                void persist({ cliente_responsaveis: { ...cliente, whatsapp: v } })
              }
            />
            <Campo
              label={t("Placa")}
              value={String(veiculo.placa ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, placa: v } })}
            />
            <Campo
              label={t("Marca")}
              value={String(veiculo.marca ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, marca: v } })}
            />
            <Campo
              label={t("Modelo")}
              value={String(veiculo.modelo ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, modelo: v } })}
            />
            <Campo
              label={t("Versão")}
              value={String(veiculo.versao ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, versao: v } })}
            />
            <Campo
              label={t("Km atual")}
              value={veiculo.km_atual != null ? String(veiculo.km_atual) : ""}
              disabled={concluida}
              onChange={(v) =>
                void persist({
                  veiculo: { ...veiculo, km_atual: v ? Number(v) : null },
                })
              }
            />
            <Campo
              label={t("Câmbio")}
              value={String(veiculo.cambio ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, cambio: v } })}
            />
            <Campo
              label={t("Combustível")}
              value={String(veiculo.combustivel ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ veiculo: { ...veiculo, combustivel: v } })}
            />
          </>
        )}

        {etapa === "fotos" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("Mínimo de")} {MINIMO_DE_FOTOS} {t("fotos")} ({fotos.length}/{MINIMO_DE_FOTOS})
            </p>
            {!concluida && (
              <Input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFoto(f);
                  e.target.value = "";
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fotos.map((f) => (
                <div key={f.id} className="relative overflow-hidden rounded-md border">
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="aspect-video bg-muted" />
                  )}
                  {!concluida && (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-background/90 px-2 py-0.5 text-xs"
                      onClick={async () => {
                        await fetch(
                          `/api/v1/avaliacao/avaliacoes/${id}/fotos?foto_id=${f.id}`,
                          { method: "DELETE", credentials: "include" },
                        );
                        setFotos((prev) => prev.filter((x) => x.id !== f.id));
                      }}
                    >
                      {t("Excluir")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {etapa === "historico" && (
          <>
            <label className="block space-y-1 text-sm">
              <span>{t("Histórico de leilão")}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                disabled={concluida}
                value={String(historico.leilao ?? "")}
                onChange={(e) =>
                  void persist({
                    historico: { ...historico, leilao: e.target.value || null },
                  })
                }
              >
                <option value="">{t("Selecione")}</option>
                <option value="sem_historico">{t("Sem histórico")}</option>
                <option value="pequena_monta">{t("Pequena monta")}</option>
                <option value="media_monta">{t("Média monta")}</option>
                <option value="financeira">{t("Financeira")}</option>
              </select>
            </label>
            <Campo
              label={t("Observações")}
              value={String(historico.observacoes ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ historico: { ...historico, observacoes: v } })}
            />
          </>
        )}

        {etapa === "estrutura" && (
          <>
            <label className="block space-y-1 text-sm">
              <span>{t("Laudo estrutural")}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                disabled={concluida}
                value={String(estrutura.laudo ?? "")}
                onChange={(e) =>
                  void persist({
                    estrutura: { ...estrutura, laudo: e.target.value || null },
                  })
                }
              >
                <option value="">{t("Selecione")}</option>
                <option value="aprovado">{t("Aprovado")}</option>
                <option value="apontamentos">{t("Apontamentos")}</option>
                <option value="reprovado">{t("Reprovado")}</option>
              </select>
            </label>
            <Campo
              label={t("Observações da estrutura")}
              value={String(estrutura.observacoes ?? "")}
              disabled={concluida}
              onChange={(v) => void persist({ estrutura: { ...estrutura, observacoes: v } })}
            />
          </>
        )}

        {(etapa === "opcionais" || etapa === "condicao_geral" || etapa === "dinamica") && (
          <Campo
            label={t("Observações")}
            value={String((data[etapa] as Record<string, unknown> | undefined)?.observacoes ?? "")}
            disabled={concluida}
            onChange={(v) =>
              void persist({
                [etapa]: {
                  ...((data[etapa] as Record<string, unknown>) ?? {}),
                  observacoes: v,
                },
              })
            }
          />
        )}

        {etapa === "negocio" && (
          <>
            <Campo
              label={t("Valor FIPE (centavos)")}
              value={
                negocio.valor_fipe_cents != null ? String(negocio.valor_fipe_cents) : ""
              }
              disabled={concluida}
              onChange={(v) =>
                void persist({
                  negocio: { ...negocio, valor_fipe_cents: v ? Number(v) : null },
                })
              }
            />
            <Campo
              label={t("Valor pretendido (centavos)")}
              value={
                negocio.valor_pretendido_cents != null
                  ? String(negocio.valor_pretendido_cents)
                  : ""
              }
              disabled={concluida}
              onChange={(v) =>
                void persist({
                  negocio: { ...negocio, valor_pretendido_cents: v ? Number(v) : null },
                })
              }
            />
            <Campo
              label={t("Débitos (centavos)")}
              value={negocio.debitos_cents != null ? String(negocio.debitos_cents) : ""}
              disabled={concluida}
              onChange={(v) =>
                void persist({
                  negocio: { ...negocio, debitos_cents: v ? Number(v) : null },
                })
              }
            />
            <Campo
              label={t("Quitação (centavos)")}
              value={negocio.quitacao_cents != null ? String(negocio.quitacao_cents) : ""}
              disabled={concluida}
              onChange={(v) =>
                void persist({
                  negocio: { ...negocio, quitacao_cents: v ? Number(v) : null },
                })
              }
            />
          </>
        )}
      </section>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <Input
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onChange(local);
        }}
      />
    </label>
  );
}
