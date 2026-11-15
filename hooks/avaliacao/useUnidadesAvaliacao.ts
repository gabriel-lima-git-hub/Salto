"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { UnidadeLinha } from "@/lib/avaliacao/unidades-campos";

export type UnidadeAvaliacao = UnidadeLinha;

export type FiltroAtivasUnidade = "ativas" | "inativas" | "todas";

export function useUnidadesAvaliacao(opts?: {
  filtro?: FiltroAtivasUnidade;
  q?: string;
  /** Quando false, não busca (ex.: módulo desligado). Default true. */
  enabled?: boolean;
}) {
  const filtro = opts?.filtro ?? "ativas";
  const q = opts?.q?.trim() ?? "";
  const active =
    filtro === "todas" ? "all" : filtro === "inativas" ? "0" : "1";

  return useQuery({
    queryKey: ["avaliacao", "unidades", filtro, q],
    enabled: opts?.enabled !== false,
    queryFn: async () => {
      const params = new URLSearchParams({ active });
      if (q) params.set("q", q);
      const r = await apiClient.get<{ data: UnidadeAvaliacao[] }>(
        `/api/v1/avaliacao/unidades?${params.toString()}`,
      );
      return r.data ?? [];
    },
    staleTime: 60_000,
  });
}
