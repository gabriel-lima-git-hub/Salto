"use client";

import {
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useAgendamentosAvaliacao } from "@/hooks/avaliacao/useAgendamentosAvaliacao";
import { useUnidadesAvaliacao } from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { CalendarPlus } from "@/lib/ui/icons";

import { AlertaSemUnidades } from "./AlertaSemUnidades";
import {
  FiltrosAvaliacao,
  type AtalhoPeriodoAvaliacao,
} from "./FiltrosAvaliacao";
import { FormularioAgendamento } from "./FormularioAgendamento";
import { GradeSemanalAvaliacao } from "./GradeSemanalAvaliacao";
import { ListaAgendamentos } from "./ListaAgendamentos";
import {
  deInputDateFim,
  deInputDateInicio,
  fimDoDia,
  inicioDoDia,
} from "./periodo";
import type { FiltrosAvaliacaoState, VisaoAvaliacao } from "./tipos";

function intervaloSemana(ancora: Date): Pick<FiltrosAvaliacaoState, "de" | "ate"> {
  const inicio = startOfWeek(ancora, { weekStartsOn: 1 });
  const fim = endOfWeek(ancora, { weekStartsOn: 1 });
  fim.setHours(23, 59, 59, 999);
  return { de: inicio.toISOString(), ate: fim.toISOString() };
}

export function AgendaAvaliacaoShell({ timezone }: { timezone: string | null }) {
  const t = useT();
  const localeDaData = useLocaleDeData();
  const [ancora, setAncora] = useState(() => new Date());
  /** `semana` = navegação semanal trava o período; `livre` = datas do filtro. */
  const [modoPeriodo, setModoPeriodo] = useState<"semana" | "livre">("semana");
  const [visao, setVisao] = useState<VisaoAvaliacao>("lista");
  const [filtrosBase, setFiltrosBase] = useState<FiltrosAvaliacaoState>(() => ({
    ...intervaloSemana(new Date()),
    status: "todos",
  }));
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [prefillQuando, setPrefillQuando] = useState<{ data: string; hora: string } | null>(null);

  const filtros = useMemo(() => {
    if (modoPeriodo === "semana") {
      return { ...filtrosBase, ...intervaloSemana(ancora) };
    }
    return filtrosBase;
  }, [ancora, filtrosBase, modoPeriodo]);

  const lista = useAgendamentosAvaliacao(filtros);
  const unidades = useUnidadesAvaliacao();

  const semanaLabel = format(startOfWeek(ancora, { weekStartsOn: 1 }), "MMMM yyyy", {
    locale: localeDaData,
  });
  const edicao = lista.data?.find((a) => a.id === editandoId) ?? null;

  const irParaSemana = (d: Date) => {
    setModoPeriodo("semana");
    setAncora(d);
  };

  const aplicarPeriodoLivre = (deIso: string, ateIso: string) => {
    setModoPeriodo("livre");
    setFiltrosBase((f) => ({ ...f, de: deIso, ate: ateIso }));
    setAncora(new Date(deIso));
  };

  const onAtalhoPeriodo = (atalho: AtalhoPeriodoAvaliacao) => {
    const agora = new Date();
    if (atalho === "hoje") {
      aplicarPeriodoLivre(inicioDoDia(agora).toISOString(), fimDoDia(agora).toISOString());
      return;
    }
    if (atalho === "semana_atual") {
      irParaSemana(agora);
      return;
    }
    // este_mes
    aplicarPeriodoLivre(
      startOfMonth(agora).toISOString(),
      fimDoDia(endOfMonth(agora)).toISOString(),
    );
  };

  const abrirNovo = () => {
    setEditandoId(null);
    setPrefillQuando(null);
    setFormAberto(true);
  };

  const abrirNovoNoHorario = (data: string, hora: string) => {
    setEditandoId(null);
    setPrefillQuando({ data, hora });
    setFormAberto(true);
  };

  const abrirEditar = (id: string) => {
    setEditandoId(id);
    setPrefillQuando(null);
    setFormAberto(true);
  };

  return (
    <div data-testid="tela-agenda-avaliacao" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Agenda de avaliação")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Horários, unidades e status da operação veicular.")}
          </p>
        </div>
        <Button type="button" onClick={abrirNovo}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          {t("Novo agendamento")}
        </Button>
      </div>

      {(unidades.data?.length ?? 0) === 0 ? (
        <AlertaSemUnidades carregando={unidades.isLoading} />
      ) : null}

      <FiltrosAvaliacao
        semanaLabel={semanaLabel}
        filtros={filtros}
        unidades={unidades.data ?? []}
        onAnterior={() => {
          setModoPeriodo("semana");
          setAncora((d) => addWeeks(d, -1));
        }}
        onProxima={() => {
          setModoPeriodo("semana");
          setAncora((d) => addWeeks(d, 1));
        }}
        onSemanaAtual={() => irParaSemana(new Date())}
        onAtalhoPeriodo={onAtalhoPeriodo}
        onPeriodoDatas={(deYmd, ateYmd) =>
          aplicarPeriodoLivre(deInputDateInicio(deYmd), deInputDateFim(ateYmd))
        }
        onChange={(patch) => setFiltrosBase((f) => ({ ...f, ...patch }))}
      />

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        <Button
          type="button"
          size="sm"
          variant={visao === "lista" ? "secondary" : "ghost"}
          onClick={() => setVisao("lista")}
        >
          {t("Lista")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={visao === "semana" ? "secondary" : "ghost"}
          onClick={() => setVisao("semana")}
        >
          {t("Semana")}
        </Button>
      </div>

      {visao === "lista" ? (
        <ListaAgendamentos
          itens={lista.data ?? []}
          carregando={lista.isLoading}
          onEditar={abrirEditar}
          onNovo={abrirNovo}
        />
      ) : (
        <GradeSemanalAvaliacao
          ancoraSemana={ancora}
          agendamentos={lista.data ?? []}
          fuso={timezone}
          onSelecionar={abrirEditar}
          onNovoNoHorario={abrirNovoNoHorario}
        />
      )}

      <FormularioAgendamento
        aberto={formAberto}
        onAbertoChange={(v) => {
          setFormAberto(v);
          if (!v) setPrefillQuando(null);
        }}
        edicao={edicao}
        unidades={unidades.data ?? []}
        prefillData={prefillQuando?.data}
        prefillHora={prefillQuando?.hora}
        onAgendamentoSalvo={(iso) => {
          setModoPeriodo("semana");
          setAncora(new Date(iso));
        }}
      />
    </div>
  );
}
