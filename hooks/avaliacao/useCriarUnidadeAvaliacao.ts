"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { UnidadeAvaliacao } from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { apiClient } from "@/lib/api/client";

export type CorpoUnidade = {
  name: string;
  cnpj: string;
  internal_code?: string | null;
  employee_count?: number | null;
  sort_order?: number;
  is_active?: boolean;
  cep?: string | null;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  phone?: string | null;
  email?: string | null;
  responsible_name?: string | null;
  notes?: string | null;
};

export function useCriarUnidadeAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (corpo: CorpoUnidade) => {
      const r = await apiClient.post<{ data: UnidadeAvaliacao }>("/api/v1/avaliacao/unidades", corpo);
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["avaliacao", "unidades"] });
    },
    onError: showApiError,
  });
}

export function useAtualizarUnidadeAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...corpo
    }: { id: string } & Partial<CorpoUnidade>) => {
      const r = await apiClient.patch<{ data: UnidadeAvaliacao }>(
        `/api/v1/avaliacao/unidades/${id}`,
        corpo,
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["avaliacao", "unidades"] });
    },
    onError: showApiError,
  });
}

export function useExcluirUnidadeAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/avaliacao/unidades/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["avaliacao", "unidades"] });
    },
    onError: showApiError,
  });
}
