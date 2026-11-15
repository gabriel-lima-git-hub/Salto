/** Helpers de período da Agenda de avaliação (doc Avaliasys §1 Agenda › Filtros). */

export function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fimDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function paraInputDate(isoOuDate: string | Date): string {
  const d = typeof isoOuDate === "string" ? new Date(isoOuDate) : isoOuDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function deInputDateInicio(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return inicioDoDia(new Date(y!, (m ?? 1) - 1, d ?? 1)).toISOString();
}

export function deInputDateFim(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return fimDoDia(new Date(y!, (m ?? 1) - 1, d ?? 1)).toISOString();
}
