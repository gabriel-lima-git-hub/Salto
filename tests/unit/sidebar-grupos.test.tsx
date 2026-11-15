/**
 * Sidebar agrupado por objetivo.
 *
 * SALTO (temporário): o menu lateral foi enxugado — só Agenda, Contatos, Casos,
 * "Ver tudo em CRM" e Configurações. Os `sidebar: true` dos demais estão
 * comentados em `lib/navigation/catalogo.ts` e os hubs extras em `Sidebar.tsx`.
 * Estes testes prendem ESSE menu enxuto; ao restaurar o menu completo, reverta
 * também as expectativas abaixo (histórico no git / comentários SALTO).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";

const authRef: { user: Pick<AuthUser, "is_platform_admin">; activeOrg: ActiveOrg | null } = {
  user: { is_platform_admin: false },
  activeOrg: null,
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => authRef,
  usePermission: () => false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/agenda",
}));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
vi.mock("@/components/shell/ContadorDeCasos", () => ({
  ContadorDeCasos: ({ compacto }: { compacto: boolean }) => (
    <span data-testid="marcador-casos" data-compacto={String(compacto)} />
  ),
}));
vi.mock("@/components/shell/ContadorDaFila", () => ({
  ContadorDaFila: ({ compacto }: { compacto: boolean }) => (
    <span data-testid="marcador-fila" data-compacto={String(compacto)} />
  ),
}));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));
vi.mock("@/components/shell/VersionFooter", () => ({
  VersionFooter: () => null,
}));

function comoPapel(role: ActiveOrg["role"]) {
  authRef.user = { is_platform_admin: false };
  authRef.activeOrg = { orgId: "org-1", name: "Org", role };
}

afterEach(cleanup);

describe("Sidebar agrupado (menu enxuto SALTO)", () => {
  it("mostra só os grupos com itens do menu enxuto", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Atendimento (Agenda), CRM (Contatos + hub), IA (Casos). Sem Canais/Análise.
    expect(titulos).toEqual(["Atendimento", "CRM", "Agente de IA"]);
  });

  it("mantém Ver tudo em CRM e esconde os outros hubs do menu", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: /Ver tudo em CRM/ })).toHaveAttribute("href", "/app/crm");
    expect(screen.queryByRole("link", { name: /Ver tudo em IA/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ver tudo em Análise/ })).toBeNull();
  });

  it("lista Agenda, Contatos e Casos — e não Inbox/Funis/Conexões", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/app/agenda");
    expect(screen.getByRole("link", { name: "Contatos" })).toHaveAttribute("href", "/app/contacts");
    expect(screen.getByRole("link", { name: /Casos/ })).toHaveAttribute("href", "/app/ai/cases");
    expect(screen.queryByRole("link", { name: /Inbox/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Conexões/ })).toBeNull();
  });

  it("o número de Casos mora no item de Casos; Fila some com o Inbox", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const casos = screen.getAllByTestId("marcador-casos");
    expect(casos).toHaveLength(1);
    expect(casos[0]!.closest("a")).toHaveAttribute("href", "/app/ai/cases");
    // Inbox fora do menu → contador da fila não desenha.
    expect(screen.queryByTestId("marcador-fila")).toBeNull();
  });

  it("Configurações fica no rodapé, nunca dependendo de scroll", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const config = screen.getByRole("link", { name: /Configurações/ });
    expect(config).toHaveAttribute("href", "/app/settings");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.contains(config)).toBe(false);
  });

  it("colapsado esconde os títulos mas mantém os links do menu enxuto", () => {
    comoPapel("admin");
    render(<Sidebar collapsed />);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Agenda/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Contatos/ })).toBeTruthy();
  });

  it("marca a rota atual com aria-current", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Contatos" })).not.toHaveAttribute("aria-current");
  });
});
