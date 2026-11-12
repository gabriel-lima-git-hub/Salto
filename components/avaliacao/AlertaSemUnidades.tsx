"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useCriarUnidadeAvaliacao } from "@/hooks/avaliacao/useCriarUnidadeAvaliacao";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK, type Role } from "@/lib/auth/types";

function podeGerirUnidades(role: Role | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.manager;
}

export function AlertaSemUnidades({ carregando }: { carregando: boolean }) {
  const t = useT();
  const org = useActiveOrg();
  const criar = useCriarUnidadeAvaliacao();
  const [nome, setNome] = useState("");

  if (carregando) return null;

  const gestor = podeGerirUnidades(org?.role);

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-foreground">
      <AlertTitle>{t("Sem unidade cadastrada")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {t(
            "O agendamento exige uma unidade (loja). Enquanto a lista de unidades estiver vazia, o servidor devolve",
          )}{" "}
          <code className="text-xs">{`{ "data": [] }`}</code> {t("e nada é gravado.")}
        </p>
        {gestor ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="av-primeira-unidade" className="text-xs font-medium">
                {t("Nome da unidade")}
              </Label>
              <Input
                id="av-primeira-unidade"
                placeholder={t("Ex.: Matriz")}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!nome.trim() || criar.isPending}
              onClick={() => {
                criar.mutate(nome, {
                  onSuccess: () => {
                    toast.success(t("Unidade criada. Agora você pode salvar o agendamento."));
                    setNome("");
                  },
                });
              }}
            >
              {t("Criar unidade")}
            </Button>
          </div>
        ) : (
          <p className="text-sm">
            {t("Peça a um gestor ou administrador para cadastrar a primeira unidade.")}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
