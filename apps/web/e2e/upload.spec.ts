import { test, expect } from '@playwright/test';

test('drop imports a large spec, rejects invalid files and retains file picker', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) external.push(request.url());
  });
  await page.goto('/');
  const zone = page.getByLabel('Área de upload de especificações');
  const invalid = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['invalid'], 'invalid.txt'));
    return data;
  });
  await zone.dispatchEvent('drop', { dataTransfer: invalid });
  await expect(zone.getByRole('alert')).toContainText('Selecione um arquivo');
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({
      openapi: '3.0.3', info: { title: 'Large drop fixture', version: '1.0.0' },
      paths: {}, 'x-padding': 'x'.repeat(10 * 1024 * 1024),
    })], 'large.json', { type: 'application/json' }));
    return transfer;
  });
  await zone.dispatchEvent('dragover', { dataTransfer: data });
  await expect(zone).toContainText('Solte o arquivo');
  await zone.dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByRole('button', { name: /Large drop fixture/ })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('input[type="file"]')).toBeEnabled({ timeout: 30000 });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'picker.yaml', mimeType: 'application/yaml',
    buffer: Buffer.from('openapi: 3.0.3\ninfo:\n  title: Picker fixture\n  version: 1.0.0\npaths: {}'),
  });
  await expect(page.getByRole('button', { name: /Picker fixture/ })).toBeVisible({ timeout: 30000 });
  expect(external).toEqual([]);
});
