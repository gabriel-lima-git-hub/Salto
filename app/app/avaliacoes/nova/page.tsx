import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

import { NovaAvaliacaoClient } from "./_client";

export const metadata = { title: "Nova Avaliação" };
export const dynamic = "force-dynamic";

export default async function NovaAvaliacaoPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(await moduloLigado(createAdminClient(), "avaliacao"))) redirect("/app");
  return <NovaAvaliacaoClient />;
}
