import { describe, expect, it } from "vitest";

import { atualizarAgendamentoSchema, criarAgendamentoSchema } from "./schemas";

const UNIT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("criarAgendamentoSchema", () => {
  it("aceita payload válido com cliente novo", () => {
    const r = criarAgendamentoSchema.safeParse({
      unit_id: UNIT,
      scheduled_at: "2026-11-12T12:00:00.000Z",
      duration_minutes: 20,
      client_name: "Maria",
      client_phone: "11999998888",
      consultant_auto: true,
    });
    expect(r.success).toBe(true);
  });

  it("recusa sem contato e sem nome/telefone", () => {
    const r = criarAgendamentoSchema.safeParse({
      unit_id: UNIT,
      scheduled_at: "2026-11-12T12:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("recusa scheduled_at sem offset", () => {
    const r = criarAgendamentoSchema.safeParse({
      unit_id: UNIT,
      scheduled_at: "2026-11-12T12:00:00",
      client_name: "Maria",
      client_phone: "11999998888",
    });
    expect(r.success).toBe(false);
  });
});

describe("atualizarAgendamentoSchema", () => {
  it("descarta client_name/client_phone/consultant_auto — não são colunas da tabela", () => {
    const r = atualizarAgendamentoSchema.safeParse({
      unit_id: UNIT,
      scheduled_at: "2026-11-12T12:00:00.000Z",
      duration_minutes: 20,
      client_name: "Maria",
      client_phone: "11999998888",
      consultant_auto: true,
      notes: "ok",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).not.toHaveProperty("client_name");
    expect(r.data).not.toHaveProperty("client_phone");
    expect(r.data).not.toHaveProperty("consultant_auto");
    expect(r.data.notes).toBe("ok");
    expect(r.data.unit_id).toBe(UNIT);
  });

  it("recusa corpo vazio", () => {
    const r = atualizarAgendamentoSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("não injeta duration_minutes default num PATCH omitido (Zod 4 + partial)", () => {
    // Regressão: partial() no Zod 4 preservava .default(20) e {} virava
    // { duration_minutes: 20 }, furando o refine de corpo vazio.
    const vazio = atualizarAgendamentoSchema.safeParse({});
    expect(vazio.success).toBe(false);

    const soNotas = atualizarAgendamentoSchema.safeParse({ notes: "remarcar" });
    expect(soNotas.success).toBe(true);
    if (!soNotas.success) return;
    expect(soNotas.data).toEqual({ notes: "remarcar" });
    expect(soNotas.data).not.toHaveProperty("duration_minutes");
  });

  it("aceita atualização com um campo e com vários campos", () => {
    const um = atualizarAgendamentoSchema.safeParse({ duration_minutes: 40 });
    expect(um.success).toBe(true);
    if (um.success) expect(um.data.duration_minutes).toBe(40);

    const varios = atualizarAgendamentoSchema.safeParse({
      unit_id: UNIT,
      scheduled_at: "2026-11-12T15:00:00.000Z",
      notes: "ok",
    });
    expect(varios.success).toBe(true);
    if (!varios.success) return;
    expect(varios.data.unit_id).toBe(UNIT);
    expect(varios.data.scheduled_at).toBe("2026-11-12T15:00:00.000Z");
    expect(varios.data.notes).toBe("ok");
  });

  it("recusa tipos inválidos", () => {
    expect(atualizarAgendamentoSchema.safeParse({ duration_minutes: 5 }).success).toBe(false);
    expect(atualizarAgendamentoSchema.safeParse({ unit_id: "nao-uuid" }).success).toBe(false);
    expect(
      atualizarAgendamentoSchema.safeParse({ scheduled_at: "2026-11-12T12:00:00" }).success,
    ).toBe(false);
  });
});
