import { test, expect } from '@playwright/test';

test.describe('Fase 01 — Foundation E2E', () => {
  test('deve carregar a aplicação localmente sem requisições externas', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        externalRequests.push(request.url());
      }
    });

    await page.goto('/');

    // Verificar que nenhuma requisição externa foi emitida
    expect(externalRequests).toHaveLength(0);

    // Verificar presença do título e badge Private Mode
    await expect(page.locator('text=SpecLens')).toBeVisible();
    await expect(page.locator('text=Private Mode: ON')).toBeVisible();

    // Navegar para Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL(/.*settings/);
    await expect(page.locator('text=Private Mode: Ativo')).toBeVisible();
    await expect(page.locator('text=Embedding Provider')).toBeVisible();
  });
});
