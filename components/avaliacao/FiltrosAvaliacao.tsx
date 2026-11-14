"use client";

import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UnidadeAvaliacao } from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { ROTULO_STATUS, STATUS_AVALIACAO } from "@/lib/avaliacao/status";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";

import { paraInputDate } from "./periodo";
import type { FiltrosAvaliacaoState } from "./tipos";

export type AtalhoPeriodoAvaliacao = "hoje" | "semana_atual" | "este_mes";

export function FiltrosAvaliacao({
  semanaLabel,
  filtros,
  unidades,
  onAnterior,
  onProxima,
  onSemanaAtual,
  onAtalhoPeriodo,
  onPeriodoDatas,
  onChange,
}: {
  semanaLabel: string;
  filtros: FiltrosAvaliacaoState;
  unidades: UnidadeAvaliacao[];
  onAnterior: () => void;
  onProxima: () => void;
  /** Doc Avaliasys: “Semana Atual”. */
  onSemanaAtual: () => void;
  onAtalhoPeriodo: (atalho: AtalhoPeriodoAvaliacao) => void;
  onPeriodoDatas: (deYmd: string, ateYmd: string) => void;
  onChange: (patch: Partial<FiltrosAvaliacaoState>) => void;
}) {
  const t = useT();
  const localeDaData = useLocaleDeData();
  const membros = useAssignableMembers(true);
  const deLocal = format(new Date(filtros.de), "dd/MM/yyyy", { locale: localeDaData });
  const ateLocal = format(new Date(filtros.ate), "dd/MM/yyyy", { locale: localeDaData });
  const deYmd = paraInputDate(filtros.de);
  const ateYmd = paraInputDate(filtros.ate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onAnterior}
          aria-label={t("Semana anterior")}
        >
          <CaretLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onProxima}
          aria-label={t("Próxima semana")}
        >
          <CaretRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onSemanaAtual}>
          {t("Semana Atual")}
        </Button>
        <span className="text-sm font-medium">{semanaLabel}</span>
        <span className="text-xs text-muted-foreground">
          {deLocal} — {ateLocal}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="av-filtro-de">{t("Data inicial")}</Label>
          <Input
            id="av-filtro-de"
            type="date"
            value={deYmd}
            onChange={(e) => {
              const novoDe = e.target.value;
              if (!novoDe) return;
              onPeriodoDatas(novoDe, ateYmd < novoDe ? novoDe : ateYmd);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="av-filtro-ate">{t("Data final")}</Label>
          <Input
            id="av-filtro-ate"
            type="date"
            value={ateYmd}
            onChange={(e) => {
              const novoAte = e.target.value;
              if (!novoAte) return;
              onPeriodoDatas(deYmd > novoAte ? novoAte : deYmd, novoAte);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-1 sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onAtalhoPeriodo("hoje")}>
            {t("Hoje")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAtalhoPeriodo("semana_atual")}
          >
            {t("Semana Atual")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAtalhoPeriodo("este_mes")}
          >
            {t("Este mês")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label>{t("Status")}</Label>
          <Select
            value={filtros.status ?? "todos"}
            onValueChange={(v) =>
              onChange({ status: v === "todos" ? "todos" : (v as (typeof STATUS_AVALIACAO)[number]) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Todos")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("Todos")}</SelectItem>
              {STATUS_AVALIACAO.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(ROTULO_STATUS[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t("Unidade")}</Label>
          <Select
            value={filtros.unit_id ?? "todas"}
            onValueChange={(v) => onChange({ unit_id: v === "todas" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Todas")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t("Todas")}</SelectItem>
              {unidades
                .filter((u) => u.is_active)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t("Consultor")}</Label>
          <Select
            value={filtros.consultant_user_id ?? "todos"}
            onValueChange={(v) =>
              onChange({ consultant_user_id: v === "todos" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Todos")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("Todos")}</SelectItem>
              {(membros.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t("Atendente")}</Label>
          <Select
            value={filtros.attendant_user_id ?? "todos"}
            onValueChange={(v) =>
              onChange({ attendant_user_id: v === "todos" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Todos")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("Todos")}</SelectItem>
              {(membros.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>{t("Busca")}</Label>
          <Input
            placeholder={t("Nome, placa ou modelo")}
            value={filtros.q ?? ""}
            onChange={(e) => onChange({ q: e.target.value || undefined })}
          />
        </div>
      </div>
    </div>
  );
}
