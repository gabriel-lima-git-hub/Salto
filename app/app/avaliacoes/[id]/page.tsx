import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

import { AssistenteAvaliacaoClient } from "./_client";

export const metadata = { title: "Assistente de avaliação" };
export const dynamic = "force-dynamic";

export default async function AssistenteAvaliacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(await moduloLigado(createAdminClient(), "avaliacao"))) redirect("/app");
  const { id } = await params;
  return <AssistenteAvaliacaoClient id={id} />;
}
