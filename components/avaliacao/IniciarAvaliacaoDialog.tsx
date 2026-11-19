"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

export function IniciarAvaliacaoDialog({ agendamentoId }: { agendamentoId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function iniciar() {
    setPending(true);
    try {
      const r = await apiClient.post<{ data: { avaliacao_id?: string | null } }>(
        `/api/v1/avaliacao/agendamentos/${agendamentoId}/acoes/iniciar_avaliacao`,
        {},
      );
      const avaliacaoId = r.data?.avaliacao_id;
      if (!avaliacaoId) {
        toast.error(t("Não foi possível abrir o assistente."));
        return;
      }
      toast.success(t("Avaliação iniciada."));
      router.push(`/app/avaliacoes/${avaliacaoId}`);
    } catch (err) {
      showApiError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          {t("Iniciar avaliação")}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Iniciar avaliação")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "O status passa para Em avaliação e o assistente abre já vinculado a este agendamento.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("Cancelar")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => void iniciar()}>
            {pending ? t("Abrindo…") : t("Iniciar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
