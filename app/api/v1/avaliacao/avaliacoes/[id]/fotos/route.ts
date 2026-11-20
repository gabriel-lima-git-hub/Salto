import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  BUCKET_AVALIACAO_FOTOS,
  fotoPertenceAAvaliacao,
  TAMANHO_MAXIMO_FOTO_AVALIACAO,
} from "@/lib/avaliacao/ficha";
import { MODULO_AVALIACAO_NAO_INSTALADO, moduloAvaliacaoNaoInstalado } from "@/lib/avaliacao/modulo";
import { extensaoDe, farejarTipo } from "@/lib/branding/logo-arquivo";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const ordemSchema = z.object({
  fotos: z.array(z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) })).max(40),
});

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const authz = await requireRole("viewer", { requestId, resource: "avaliacao_avaliacao_fotos" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data: fotos, error } = await supabase
    .from("avaliacao_avaliacao_fotos")
    .select("id, storage_path, sort_order, created_at")
    .eq("avaliacao_id", id)
    .eq("organization_id", authz.org.orgId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (moduloAvaliacaoNaoInstalado(error)) {
      return fail("module_not_installed", MODULO_AVALIACAO_NAO_INSTALADO, 409, { requestId });
    }
    return fail("internal_error", error.message, 500, { requestId });
  }

  const comUrl = await Promise.all(
    (fotos ?? []).map(async (f) => {
      const { data: signed } = await createAdminClient()
        .storage.from(BUCKET_AVALIACAO_FOTOS)
        .createSignedUrl(f.storage_path, 3600);
      return { ...f, url: signed?.signedUrl ?? null };
    }),
  );

  return ok(comUrl, { requestId });
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacao_fotos" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data: av } = await supabase
    .from("avaliacao_avaliacoes")
    .select("id, concluida_at")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!av) return fail("not_found", "Avaliação não encontrada.", 404, { requestId });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return fail("validation_failed", "Campo 'file' (multipart) obrigatório.", 422, { requestId });
  }
  if (file.size > TAMANHO_MAXIMO_FOTO_AVALIACAO) {
    return fail("payload_too_large", "A foto precisa ter até 5 MB.", 413, { requestId });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = farejarTipo(bytes);
  if (!tipo) {
    return fail("unsupported_media_type", "A foto precisa ser JPG ou PNG.", 415, { requestId });
  }

  const { count } = await supabase
    .from("avaliacao_avaliacao_fotos")
    .select("id", { count: "exact", head: true })
    .eq("avaliacao_id", id)
    .eq("organization_id", authz.org.orgId);

  const caminho = `${authz.org.orgId}/${id}/${randomUUID()}.${extensaoDe(tipo)}`;
  const { error: upErr } = await createAdminClient()
    .storage.from(BUCKET_AVALIACAO_FOTOS)
    .upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (upErr) {
    logger.error("[avaliacao/fotos] upload falhou", { detalhe: upErr.message, requestId });
    return fail("internal_error", "Erro ao subir a foto.", 500, { requestId });
  }

  const { data, error } = await supabase
    .from("avaliacao_avaliacao_fotos")
    .insert({
      organization_id: authz.org.orgId,
      avaliacao_id: id,
      storage_path: caminho,
      sort_order: count ?? 0,
    })
    .select("id, storage_path, sort_order")
    .single();

  if (error) {
    await createAdminClient().storage.from(BUCKET_AVALIACAO_FOTOS).remove([caminho]);
    return fail("internal_error", error.message, 500, { requestId });
  }

  void audit({
    action: "avaliacao.foto_adicionada",
    resourceType: "avaliacao_avaliacao",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { foto_id: data.id },
  });

  const { data: signed } = await createAdminClient()
    .storage.from(BUCKET_AVALIACAO_FOTOS)
    .createSignedUrl(caminho, 3600);

  return ok({ ...data, url: signed?.signedUrl ?? null }, { requestId, status: 201 });
}

export async function PUT(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacao_fotos" });
  if (!authz.ok) return authz.response;

  const body = ordemSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return fail("validation_failed", "Lista de fotos inválida.", 422, { requestId });
  }

  const supabase = await createClient();
  for (const f of body.data.fotos) {
    await supabase
      .from("avaliacao_avaliacao_fotos")
      .update({ sort_order: f.sort_order })
      .eq("id", f.id)
      .eq("avaliacao_id", id)
      .eq("organization_id", authz.org.orgId);
  }

  return ok({ ok: true }, { requestId });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const admin = createAdminClient();
  if (!(await moduloLigado(admin, "avaliacao"))) return fail("not_found", "Not found", 404, { requestId });

  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent", { requestId, resource: "avaliacao_avaliacao_fotos" });
  if (!authz.ok) return authz.response;

  const fotoId = new URL(req.url).searchParams.get("foto_id");
  if (!fotoId || !z.string().uuid().safeParse(fotoId).success) {
    return fail("validation_failed", "foto_id obrigatório.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: foto, error } = await supabase
    .from("avaliacao_avaliacao_fotos")
    .delete()
    .eq("id", fotoId)
    .eq("avaliacao_id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id, storage_path")
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!foto) return fail("not_found", "Foto não encontrada.", 404, { requestId });

  if (fotoPertenceAAvaliacao(foto.storage_path, authz.org.orgId, id)) {
    await createAdminClient().storage.from(BUCKET_AVALIACAO_FOTOS).remove([foto.storage_path]);
  }

  void audit({
    action: "avaliacao.foto_removida",
    resourceType: "avaliacao_avaliacao",
    resourceId: id,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    metadata: { foto_id: fotoId },
  });

  return ok({ id: fotoId }, { requestId });
}
