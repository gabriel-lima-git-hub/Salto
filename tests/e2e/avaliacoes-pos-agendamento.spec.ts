import { expect, test, type Page } from "./helpers/test";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

/**
 * Histórico + assistente de avaliações — exige módulo `avaliacao` instalado.
 * Fora do CI padrão até o seed instalar o módulo de nicho de forma estável
 * (mesmo motivo de `agenda-avaliacao.spec.ts`).
 */
test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("Avaliações pós-agendamento", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginComoAdmin(page, lerCreds());
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("histórico responde em /app/avaliacoes quando o módulo está ativo", async () => {
    await page.goto("/app/avaliacoes");
    const tela = page.getByTestId("tela-avaliacoes");
    const redirecionou = page.url().includes("/app") && !page.url().includes("/avaliacoes");
    if (redirecionou) {
      // Módulo desligado: a página redireciona — não falha a suíte local sem seed.
      test.skip(true, "módulo avaliacao não instalado nesta instância");
      return;
    }
    await expect(tela).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: /Nova Avaliação/i })).toBeVisible();
  });

  test("nova avaliação abre o assistente", async () => {
    await page.goto("/app/avaliacoes");
    if (!page.url().includes("/avaliacoes")) {
      test.skip(true, "módulo avaliacao não instalado nesta instância");
      return;
    }
    await page.getByRole("link", { name: /Nova Avaliação/i }).click();
    await expect(page).toHaveURL(/\/app\/avaliacoes\/nova/);
    await expect(page.getByRole("heading", { name: /Nova Avaliação/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
