"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  useAtualizarUnidadeAvaliacao,
  useCriarUnidadeAvaliacao,
  useExcluirUnidadeAvaliacao,
  type CorpoUnidade,
} from "@/hooks/avaliacao/useCriarUnidadeAvaliacao";
import {
  useUnidadesAvaliacao,
  type FiltroAtivasUnidade,
  type UnidadeAvaliacao,
} from "@/hooks/avaliacao/useUnidadesAvaliacao";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK, type Role } from "@/lib/auth/types";
import { formatarCnpjUnidade } from "@/lib/avaliacao/cnpj-unidade";
import { Buildings, MagnifyingGlass, Plus } from "@/lib/ui/icons";

function podeGerir(role: Role | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.manager;
}

type FormState = {
  name: string;
  cnpj: string;
  internal_code: string;
  employee_count: string;
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement: string;
  phone: string;
  email: string;
  responsible_name: string;
  notes: string;
  is_active: boolean;
};

const FORM_VAZIO: FormState = {
  name: "",
  cnpj: "",
  internal_code: "",
  employee_count: "",
  cep: "",
  state: "",
  city: "",
  neighborhood: "",
  street: "",
  number: "",
  complement: "",
  phone: "",
  email: "",
  responsible_name: "",
  notes: "",
  is_active: true,
};

function deLinha(u: UnidadeAvaliacao): FormState {
  return {
    name: u.name,
    cnpj: formatarCnpjUnidade(u.cnpj) || u.cnpj || "",
    internal_code: u.internal_code ?? "",
    employee_count: u.employee_count != null ? String(u.employee_count) : "",
    cep: u.cep ?? "",
    state: u.state ?? "",
    city: u.city ?? "",
    neighborhood: u.neighborhood ?? "",
    street: u.street ?? "",
    number: u.number ?? "",
    complement: u.complement ?? "",
    phone: u.phone ?? "",
    email: u.email ?? "",
    responsible_name: u.responsible_name ?? "",
    notes: u.notes ?? "",
    is_active: u.is_active,
  };
}

function paraCorpo(f: FormState): CorpoUnidade {
  const employee =
    f.employee_count.trim() === "" ? null : Number.parseInt(f.employee_count, 10);
  return {
    name: f.name.trim(),
    cnpj: f.cnpj.trim(),
    internal_code: f.internal_code.trim() || null,
    employee_count: Number.isFinite(employee) ? employee : null,
    cep: f.cep.trim() || null,
    state: f.state.trim() ? f.state.trim().toUpperCase() : null,
    city: f.city.trim() || null,
    neighborhood: f.neighborhood.trim() || null,
    street: f.street.trim() || null,
    number: f.number.trim() || null,
    complement: f.complement.trim() || null,
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    responsible_name: f.responsible_name.trim() || null,
    notes: f.notes.trim() || null,
    is_active: f.is_active,
  };
}

export function UnidadesClient() {
  const t = useT();
  const tagDeIdioma = useTagDeIdioma();
  const org = useActiveOrg();
  const gestor = podeGerir(org?.role);

  function formatarData(iso: string): string {
    try {
      return new Intl.DateTimeFormat(tagDeIdioma, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const [filtro, setFiltro] = useState<FiltroAtivasUnidade>("todas");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<UnidadeAvaliacao | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [detalhe, setDetalhe] = useState<UnidadeAvaliacao | null>(null);
  const [excluindo, setExcluindo] = useState<UnidadeAvaliacao | null>(null);

  const { data: unidades = [], isLoading } = useUnidadesAvaliacao({
    filtro,
    q: busca,
  });
  const criar = useCriarUnidadeAvaliacao();
  const atualizar = useAtualizarUnidadeAvaliacao();
  const excluir = useExcluirUnidadeAvaliacao();

  const salvando = criar.isPending || atualizar.isPending;

  const tituloDialog = useMemo(
    () => (editando ? t("Editar unidade") : t("Nova unidade")),
    [editando, t],
  );

  function abrirNova() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setAberto(true);
  }

  function abrirEdicao(u: UnidadeAvaliacao) {
    setEditando(u);
    setForm(deLinha(u));
    setAberto(true);
  }

  function setCampo<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function salvar() {
    const corpo = paraCorpo(form);
    if (!corpo.name || !corpo.cnpj) {
      toast.error(t("Nome e CNPJ são obrigatórios."));
      return;
    }
    if (editando) {
      atualizar.mutate(
        { id: editando.id, ...corpo },
        {
          onSuccess: () => {
            toast.success(t("Unidade atualizada."));
            setAberto(false);
          },
        },
      );
    } else {
      criar.mutate(corpo, {
        onSuccess: () => {
          toast.success(t("Unidade criada."));
          setAberto(false);
        },
      });
    }
  }

  function alternarStatus(u: UnidadeAvaliacao) {
    atualizar.mutate(
      { id: u.id, is_active: !u.is_active },
      {
        onSuccess: () => {
          toast.success(u.is_active ? t("Unidade inativada.") : t("Unidade ativada."));
        },
      },
    );
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    const id = excluindo.id;
    excluir.mutate(id, {
      onSuccess: () => {
        toast.success(t("Unidade excluída."));
        setExcluindo(null);
        if (detalhe?.id === id) setDetalhe(null);
      },
    });
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Buildings className="size-6" aria-hidden />
            {t("Unidades")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t(
              "Cadastro das lojas e filiais usadas na agenda de avaliação. Unidades inativas não aparecem em novos agendamentos.",
            )}
          </p>
        </div>
        {gestor ? (
          <Button type="button" onClick={abrirNova}>
            <Plus className="size-4" />
            {t("Nova unidade")}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <Label htmlFor="unidades-busca">{t("Buscar por nome ou CNPJ")}</Label>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="unidades-busca"
              className="pl-8"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setBusca(buscaInput.trim());
              }}
              placeholder={t("Nome ou CNPJ")}
            />
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => setBusca(buscaInput.trim())}>
          {t("Buscar")}
        </Button>
        <div className="w-44 space-y-1">
          <Label>{t("Status")}</Label>
          <Select
            value={filtro}
            onValueChange={(v) => setFiltro(v as FiltroAtivasUnidade)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t("Todas")}</SelectItem>
              <SelectItem value="ativas">{t("Ativas")}</SelectItem>
              <SelectItem value="inativas">{t("Inativas")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Nome da unidade")}</TableHead>
              <TableHead>{t("CNPJ")}</TableHead>
              <TableHead>{t("Cidade/UF")}</TableHead>
              <TableHead>{t("Funcionários")}</TableHead>
              <TableHead>{t("Responsável")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead>{t("Data de cadastro")}</TableHead>
              <TableHead className="text-right">{t("Ações")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  {t("Carregando…")}
                </TableCell>
              </TableRow>
            ) : unidades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  {t("Nenhuma unidade encontrada.")}
                </TableCell>
              </TableRow>
            ) : (
              unidades.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{formatarCnpjUnidade(u.cnpj) || "—"}</TableCell>
                  <TableCell>
                    {[u.city, u.state].filter(Boolean).join("/") || "—"}
                  </TableCell>
                  <TableCell>{u.employee_count ?? "—"}</TableCell>
                  <TableCell>{u.responsible_name || "—"}</TableCell>
                  <TableCell>{u.is_active ? t("Ativa") : t("Inativa")}</TableCell>
                  <TableCell>{formatarData(u.created_at)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDetalhe(u)}>
                      {t("Detalhes")}
                    </Button>
                    {gestor ? (
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(u)}>
                          {t("Editar")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => alternarStatus(u)}
                          disabled={atualizar.isPending}
                        >
                          {u.is_active ? t("Inativar") : t("Ativar")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setExcluindo(u)}
                          disabled={excluir.isPending}
                        >
                          {t("Excluir")}
                        </Button>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tituloDialog}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Campo label={t("Nome da unidade")} required>
              <Input value={form.name} onChange={(e) => setCampo("name", e.target.value)} />
            </Campo>
            <Campo label={t("CNPJ")} required>
              <Input
                value={form.cnpj}
                onChange={(e) => setCampo("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label={t("Código interno")}>
                <Input
                  value={form.internal_code}
                  onChange={(e) => setCampo("internal_code", e.target.value)}
                />
              </Campo>
              <Campo label={t("Quantidade de funcionários")}>
                <Input
                  type="number"
                  min={0}
                  value={form.employee_count}
                  onChange={(e) => setCampo("employee_count", e.target.value)}
                />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label={t("CEP")}>
                <Input value={form.cep} onChange={(e) => setCampo("cep", e.target.value)} />
              </Campo>
              <Campo label={t("Estado (UF)")}>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setCampo("state", e.target.value.toUpperCase())}
                />
              </Campo>
              <Campo label={t("Cidade")}>
                <Input value={form.city} onChange={(e) => setCampo("city", e.target.value)} />
              </Campo>
            </div>
            <Campo label={t("Bairro")}>
              <Input
                value={form.neighborhood}
                onChange={(e) => setCampo("neighborhood", e.target.value)}
              />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Campo label={t("Rua/Avenida")}>
                  <Input value={form.street} onChange={(e) => setCampo("street", e.target.value)} />
                </Campo>
              </div>
              <Campo label={t("Número")}>
                <Input value={form.number} onChange={(e) => setCampo("number", e.target.value)} />
              </Campo>
            </div>
            <Campo label={t("Complemento")}>
              <Input
                value={form.complement}
                onChange={(e) => setCampo("complement", e.target.value)}
              />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label={t("Telefone de contato")}>
                <Input value={form.phone} onChange={(e) => setCampo("phone", e.target.value)} />
              </Campo>
              <Campo label={t("E-mail da unidade")}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setCampo("email", e.target.value)}
                />
              </Campo>
            </div>
            <Campo label={t("Nome do responsável")}>
              <Input
                value={form.responsible_name}
                onChange={(e) => setCampo("responsible_name", e.target.value)}
              />
            </Campo>
            <Campo label={t("Observações internas")}>
              <Textarea
                value={form.notes}
                onChange={(e) => setCampo("notes", e.target.value)}
                rows={3}
              />
            </Campo>
            <Campo label={t("Status")}>
              <Select
                value={form.is_active ? "ativa" : "inativa"}
                onValueChange={(v) => setCampo("is_active", v === "ativa")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">{t("Ativa")}</SelectItem>
                  <SelectItem value="inativa">{t("Inativa")}</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando}>
              {t("Salvar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detalhe?.name}</DialogTitle>
          </DialogHeader>
          {detalhe ? (
            <dl className="grid gap-2 text-sm">
              <LinhaDetalhe rotulo={t("CNPJ")} valor={formatarCnpjUnidade(detalhe.cnpj)} />
              <LinhaDetalhe rotulo={t("Código interno")} valor={detalhe.internal_code} />
              <LinhaDetalhe
                rotulo={t("Endereço")}
                valor={[
                  detalhe.street,
                  detalhe.number,
                  detalhe.complement,
                  detalhe.neighborhood,
                  detalhe.city,
                  detalhe.state,
                  detalhe.cep,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <LinhaDetalhe rotulo={t("Telefone de contato")} valor={detalhe.phone} />
              <LinhaDetalhe rotulo={t("E-mail da unidade")} valor={detalhe.email} />
              <LinhaDetalhe rotulo={t("Responsável")} valor={detalhe.responsible_name} />
              <LinhaDetalhe
                rotulo={t("Funcionários")}
                valor={detalhe.employee_count != null ? String(detalhe.employee_count) : null}
              />
              <LinhaDetalhe
                rotulo={t("Status")}
                valor={detalhe.is_active ? t("Ativa") : t("Inativa")}
              />
              <LinhaDetalhe rotulo={t("Observações internas")} valor={detalhe.notes} />
              <LinhaDetalhe rotulo={t("Data de cadastro")} valor={formatarData(detalhe.created_at)} />
            </dl>
          ) : null}
          <DialogFooter>
            {gestor && detalhe ? (
              <Button
                type="button"
                onClick={() => {
                  setDetalhe(null);
                  abrirEdicao(detalhe);
                }}
              >
                {t("Editar")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Excluir unidade")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Só é possível excluir unidades sem agendamentos. Se houver histórico, inative a unidade em vez de excluir.",
              )}
              {excluindo ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">{excluindo.name}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={excluir.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}

function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd>{valor?.trim() ? valor : "—"}</dd>
    </div>
  );
}
