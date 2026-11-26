"use client";

import { useMutation } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { VeiculoConsultado } from "@/lib/apibrasil/mapear-veiculo";

export function useConsultaPlaca() {
  return useMutation({
    mutationFn: async (placa: string) => {
      const r = await apiClient.post<{ data: { veiculo: VeiculoConsultado } }>(
        "/api/v1/avaliacao/veiculos/consulta-placa",
        { placa },
      );
      return r.data.veiculo;
    },
    onError: (err) => {
      showApiError(err);
    },
  });
}
