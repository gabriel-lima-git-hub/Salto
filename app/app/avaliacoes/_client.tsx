"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAvaliacoes } from "@/hooks/avaliacao/useAvaliacoes";
import { useUnidadesAvaliacao } from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { useT } from "@/hooks/i18n/useT";
import { ROTULO_STATUS_LAUDO, type StatusLaudo } from "@/lib/avaliacao/ficha";

function contatoDe(row: {
  contacts:
    | { name?: string; phone_number?: string }
    | { name?: string; phone_number?: string }[]
    | null;
}): { nome: string; whatsapp: string } {
  const c = row.contacts;
  const contato = Array.isArray(c) ? c[0] : c;
  return {
    nome: contato?.name ?? "—",
    whatsapp: contato?.phone_number ?? "—",
  };
}

function placaDe(veiculo: Record<string, unknown> | null): string {
  const p = veiculo?.placa;
  return typeof p === "string" && p.trim() ? p.trim().toUpperCase() : "—";
}

function veiculoDe(veiculo: Record<string, unknown> | null): string {
  const marca = typeof veiculo?.marca === "string" ? veiculo.marca : "";
  const modelo = typeof veiculo?.modelo === "string" ? veiculo.modelo : "";
  return [marca, modelo].filter(Boolean).join(" ") || "—";
}

export function AvaliacoesHistoricoClient() {
  const t = useT();
  const [aba, setAba] = useState<"todas" | "concluido" | "incompleta">("todas");
  const [q, setQ] = useState("");
  const [unitId, setUnitId] = useState<string>("");
  const { data: unidades } = useUnidadesAvaliacao();
  const { data, isLoading } = useAvaliacoes({
    aba,
    q: q.trim() || undefined,
    unit_id: unitId || undefined,
  });

  const abas = useMemo(
    () =>
      [
        { id: "todas" as const, label: t("Todas") },
        { id: "concluido" as const, label: t("Concluído") },
        { id: "incompleta" as const, label: t("Incompleta") },
      ] as const,
    [t],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6" data-testid="tela-avaliacoes">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Avaliações")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Histórico de inspeções e fichas do veículo.")}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/avaliacoes/nova">{t("Nova Avaliação")}</Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t("Buscar")}</span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Cliente, placa ou modelo")}
            className="w-56"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t("Unidade")}</span>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">{t("Todas")}</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 border-b">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              aba === a.id
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma avaliação neste filtro.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {data.map((row) => {
            const laudo = (row.status_laudo as StatusLaudo) || "incompleta";
            const contato = contatoDe(row);
            return (
              <li key={row.id}>
                <Link
                  href={`/app/avaliacoes/${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium">
                      {placaDe(row.veiculo)} · {veiculoDe(row.veiculo)}
                    </div>
                    <div className="text-muted-foreground">
                      {contato.nome} · {contato.whatsapp} ·{" "}
                      {new Date(row.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs">
                    {t(ROTULO_STATUS_LAUDO[laudo] ?? laudo)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
