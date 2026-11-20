"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";

export type AvaliacaoListaItem = {
  id: string;
  status_laudo: string;
  tipo: string;
  concluida_at: string | null;
  created_at: string;
  veiculo: Record<string, unknown> | null;
  contacts: { name?: string; phone_number?: string } | { name?: string; phone_number?: string }[] | null;
  avaliacao_unidades: { name?: string } | { name?: string }[] | null;
  consultant_user_id: string | null;
};

export function useAvaliacoes(filtros: {
  aba?: string;
  unit_id?: string;
  q?: string;
  de?: string;
  ate?: string;
}) {
  const params = new URLSearchParams();
  if (filtros.aba) params.set("aba", filtros.aba);
  if (filtros.unit_id) params.set("unit_id", filtros.unit_id);
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.de) params.set("de", filtros.de);
  if (filtros.ate) params.set("ate", filtros.ate);

  return useQuery({
    queryKey: ["avaliacao", "avaliacoes", Object.fromEntries(params)],
    queryFn: async () => {
      const r = await apiClient.get<{ data: AvaliacaoListaItem[] }>(
        `/api/v1/avaliacao/avaliacoes?${params.toString()}`,
      );
      return r.data;
    },
  });
}

export function useAvaliacao(id: string | undefined) {
  return useQuery({
    queryKey: ["avaliacao", "avaliacoes", id],
    enabled: !!id,
    queryFn: async () => {
      const r = await apiClient.get<{ data: Record<string, unknown> }>(
        `/api/v1/avaliacao/avaliacoes/${id}`,
      );
      return r.data;
    },
  });
}

export function useMutacaoAvaliacao(id: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["avaliacao", "avaliacoes"] });
    void qc.invalidateQueries({ queryKey: ["avaliacao", "avaliacoes", id] });
  };

  const salvar = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      apiClient.patch(`/api/v1/avaliacao/avaliacoes/${id}`, body),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const concluir = useMutation({
    mutationFn: async (status_laudo: "aprovado" | "apontamento" | "reprovado") =>
      apiClient.post(`/api/v1/avaliacao/avaliacoes/${id}/concluir`, { status_laudo }),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const excluir = useMutation({
    mutationFn: async () => apiClient.delete(`/api/v1/avaliacao/avaliacoes/${id}`),
    onSuccess: invalidar,
    onError: showApiError,
  });

  return { salvar, concluir, excluir, invalidar };
}
