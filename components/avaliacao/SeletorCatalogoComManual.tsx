"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { CaretDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Select com busca + flag “Não encontrou?”.
 *
 * Lista INLINE (sem Portal): Popover/Portal dentro de `Sheet` engolia o clique
 * e impedia escolher item da lista — medido no formulário de agendamento.
 */
export function SeletorCatalogoComManual({
  id,
  rotulo,
  valor,
  manual,
  opcoes,
  desabilitado,
  /** Impede desligar “Não encontrou?” (ex.: marca também é manual). */
  travarManual,
  placeholderVazio,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  manual: boolean;
  opcoes: readonly string[];
  desabilitado?: boolean;
  travarManual?: boolean;
  placeholderVazio?: string;
  onChange: (proximo: { valor: string; manual: boolean }) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raizRef = useRef<HTMLDivElement>(null);
  const emManual = manual || Boolean(travarManual);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => o.toLowerCase().includes(q));
  }, [busca, opcoes]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  useEffect(() => {
    // Troca de opções (ex.: mudou a marca) fecha a lista aberta.
    setAberto(false);
    setBusca("");
  }, [opcoes]);

  return (
    <div className="space-y-2" ref={raizRef}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{rotulo}</Label>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-manual`} className="text-xs font-normal text-muted-foreground">
            {t("Não encontrou?")}
          </Label>
          <Switch
            id={`${id}-manual`}
            checked={emManual}
            disabled={desabilitado || travarManual}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange({ valor, manual: true });
                setAberto(false);
              } else {
                const canon = opcoes.find((o) => o.toLowerCase() === valor.trim().toLowerCase());
                onChange({ valor: canon ?? "", manual: false });
              }
            }}
          />
        </div>
      </div>

      {emManual ? (
        <Input
          id={id}
          value={valor}
          disabled={desabilitado}
          placeholder={t("Informe manualmente")}
          onChange={(e) => onChange({ valor: e.target.value, manual: true })}
        />
      ) : (
        <div className="relative">
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={desabilitado || opcoes.length === 0}
            aria-expanded={aberto}
            aria-haspopup="listbox"
            className={cn(
              "h-9 w-full justify-between font-normal",
              !valor && "text-muted-foreground",
            )}
            onClick={() => setAberto((v) => !v)}
          >
            <span className="truncate">{valor || placeholderVazio || t("Opcional")}</span>
            <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>

          {aberto && opcoes.length > 0 ? (
            <div
              role="listbox"
              className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
            >
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Pesquisar…")}
                className="mb-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAberto(false);
                    setBusca("");
                  }
                }}
              />
              <div className="max-h-56 overflow-y-auto">
                <button
                  type="button"
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                  onClick={() => {
                    onChange({ valor: "", manual: false });
                    setAberto(false);
                    setBusca("");
                  }}
                >
                  —
                </button>
                {filtradas.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    {t("Nenhum resultado. Use “Não encontrou?”.")}
                  </p>
                ) : (
                  filtradas.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      aria-selected={o === valor}
                      className={cn(
                        "flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                        o === valor && "bg-accent",
                      )}
                      onClick={() => {
                        onChange({ valor: o, manual: false });
                        setAberto(false);
                        setBusca("");
                      }}
                    >
                      {o}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
