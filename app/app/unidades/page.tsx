import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

import { UnidadesClient } from "./_client";

export const metadata = { title: "Unidades" };
export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  if (!(await moduloLigado(createAdminClient(), "avaliacao"))) {
    redirect("/app");
  }

  return <UnidadesClient />;
}
