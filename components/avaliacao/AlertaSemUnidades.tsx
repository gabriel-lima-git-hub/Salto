"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK, type Role } from "@/lib/auth/types";

function podeGerirUnidades(role: Role | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.manager;
}

export function AlertaSemUnidades({ carregando }: { carregando: boolean }) {
  const t = useT();
  const org = useActiveOrg();

  if (carregando) return null;

  const gestor = podeGerirUnidades(org?.role);

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-foreground">
      <AlertTitle>{t("Sem unidade cadastrada")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {t(
            "O agendamento exige uma unidade (loja). Cadastre a primeira unidade com CNPJ e dados da loja para liberar a agenda.",
          )}
        </p>
        {gestor ? (
          <Button type="button" asChild>
            <Link href="/app/unidades">{t("Cadastrar unidades")}</Link>
          </Button>
        ) : (
          <p className="text-sm">
            {t("Peça a um gestor ou administrador para cadastrar a primeira unidade.")}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
