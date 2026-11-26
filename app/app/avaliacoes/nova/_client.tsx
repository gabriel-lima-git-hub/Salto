"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConsultaPlaca } from "@/hooks/avaliacao/useConsultaPlaca";
import { useUnidadesAvaliacao } from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

export function NovaAvaliacaoClient() {
  const t = useT();
  const router = useRouter();
  const { data: unidades } = useUnidadesAvaliacao();
  const consultaPlaca = useConsultaPlaca();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    unit_id: "",
    placa: "",
    marca: "",
    modelo: "",
    tipo: "propria" as "propria" | "apoio" | "repasse",
  });

  async function criar() {
    setPending(true);
    try {
      const r = await apiClient.post<{ data: { id: string } }>("/api/v1/avaliacao/avaliacoes", {
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_email: form.client_email || undefined,
        unit_id: form.unit_id,
        tipo: form.tipo,
        veiculo: {
          placa: form.placa || undefined,
          marca: form.marca || undefined,
          modelo: form.modelo || undefined,
        },
      });
      toast.success(t("Avaliação criada."));
      router.push(`/app/avaliacoes/${r.data.id}`);
    } catch (err) {
      showApiError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("Nova Avaliação")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Abre o assistente sem agendamento prévio.")}
        </p>
      </header>

      <label className="space-y-1 text-sm">
        <span>{t("Nome completo")} *</span>
        <Input
          value={form.client_name}
          onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>{t("WhatsApp")} *</span>
        <Input
          value={form.client_phone}
          onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>{t("E-mail")}</span>
        <Input
          value={form.client_email}
          onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>{t("Unidade")} *</span>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.unit_id}
          onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value }))}
        >
          <option value="">{t("Selecione")}</option>
          {(unidades ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>{t("Tipo")}</span>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.tipo}
          onChange={(e) =>
            setForm((f) => ({ ...f, tipo: e.target.value as typeof form.tipo }))
          }
        >
          <option value="propria">{t("Própria")}</option>
          <option value="apoio">{t("Apoio")}</option>
          <option value="repasse">{t("Repasse")}</option>
        </select>
      </label>
      <div className="space-y-2">
        <label className="space-y-1 text-sm">
          <span>{t("Placa")}</span>
          <div className="flex gap-2">
            <Input
              className="flex-1 uppercase"
              value={form.placa}
              onChange={(e) =>
                setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))
              }
            />
            <Button
              type="button"
              variant="outline"
              disabled={!form.placa.trim() || consultaPlaca.isPending}
              onClick={() => {
                consultaPlaca.mutate(form.placa, {
                  onSuccess: (v) => {
                    setForm((f) => ({
                      ...f,
                      placa: v.placa,
                      marca: v.marca,
                      modelo: v.modelo,
                    }));
                    toast.success(t("Dados do veículo preenchidos pela placa."));
                  },
                });
              }}
            >
              {consultaPlaca.isPending ? t("Consultando…") : t("Consultar placa")}
            </Button>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span>{t("Marca")}</span>
            <Input
              value={form.marca}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("Modelo")}</span>
            <Input
              value={form.modelo}
              onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
            />
          </label>
        </div>
      </div>

      <Button
        disabled={
          pending || !form.client_name.trim() || !form.client_phone.trim() || !form.unit_id
        }
        onClick={() => void criar()}
      >
        {pending ? t("Salvando…") : t("Abrir assistente")}
      </Button>
    </div>
  );
}
