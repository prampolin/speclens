import { test, expect } from '@playwright/test';

const fixture = `openapi: 3.0.3
info:
  title: SpecLens Ollama E2E Fixture
  version: 1.0.0
paths:
  /e2e-products:
    get:
      operationId: listE2eProducts
      summary: Listar produtos fictícios da jornada E2E
      responses:
        '200':
          description: Lista fictícia
`;

test('importa, salva modelo, consulta, troca modelo sem reiniciar e mostra fallback para modelo ausente', async ({ page, request }) => {
  const fakeOllamaUrl = process.env.SPECLENS_FAKE_OLLAMA_URL;
  if (!fakeOllamaUrl) throw new Error('Execute este E2E via scripts/test-ollama-e2e.sh');
  const externalRequests: string[] = [];
  page.on('request', (browserRequest) => {
    const hostname = new URL(browserRequest.url()).hostname;
    if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '[::1]') {
      externalRequests.push(browserRequest.url());
    }
  });

  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ollama-e2e.yaml',
    mimeType: 'application/yaml',
    buffer: Buffer.from(fixture),
  });
  await expect(page.getByRole('button', { name: /SpecLens Ollama E2E Fixture/ })).toBeVisible({ timeout: 15_000 });
  const question = page.getByRole('textbox', { name: 'Pergunta sobre a especificação OpenAPI' });
  await expect(question).toBeEnabled({ timeout: 20_000 });

  await page.goto('/settings');
  const modelField = page.getByLabel('Modelo Instalado Selecionado');
  await modelField.clear();
  await modelField.fill('speclens-e2e-a:latest');
  await expect(modelField).toHaveValue('speclens-e2e-a:latest');
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.getByRole('status')).toContainText('Configurações salvas com sucesso.');
  await expect.poll(async () => {
    const settings = (await (await request.get(`${process.env.SPECLENS_E2E_BASE_URL}/api/settings?workspaceId=default`)).json()).settings;
    expect(settings.privateMode).toBe(true);
    return settings.llm.modelId;
  }).toBe('speclens-e2e-a:latest');

  await page.goto('/');
  await question.fill('Como listar os produtos fictícios?');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await expect(page.getByText('Mock Ollama explanation grounded in the imported contract.')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('/e2e-products').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar código' })).toBeVisible({ timeout: 20_000 });

  let modelRequests = await (await request.get(`${fakeOllamaUrl}/__test/model-requests`)).json();
  expect(modelRequests.models).toContain('speclens-e2e-a:latest');

  await page.goto('/settings');
  await expect(modelField).toHaveValue('speclens-e2e-a:latest');
  await modelField.clear();
  await modelField.fill('speclens-e2e-b:latest');
  await expect(modelField).toHaveValue('speclens-e2e-b:latest');
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.getByRole('status')).toContainText('Configurações salvas com sucesso.');
  await expect.poll(async () => (await (await request.get(`${process.env.SPECLENS_E2E_BASE_URL}/api/settings?workspaceId=default`)).json()).settings.llm.modelId).toBe('speclens-e2e-b:latest');
  await page.goto('/');
  await question.fill('Liste novamente os produtos fictícios.');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await expect(page.getByText('Mock Ollama explanation grounded in the imported contract.').last()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Copiar código' })).toBeVisible({ timeout: 20_000 });
  modelRequests = await (await request.get(`${fakeOllamaUrl}/__test/model-requests`)).json();
  expect(modelRequests.models).toContain('speclens-e2e-b:latest');

  await page.goto('/settings');
  await expect(modelField).toHaveValue('speclens-e2e-b:latest');
  await modelField.clear();
  await modelField.fill('speclens-e2e-missing:latest');
  await expect(modelField).toHaveValue('speclens-e2e-missing:latest');
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.getByRole('status')).toContainText('Configurações salvas com sucesso.');
  await expect.poll(async () => (await (await request.get(`${process.env.SPECLENS_E2E_BASE_URL}/api/settings?workspaceId=default`)).json()).settings.llm.modelId).toBe('speclens-e2e-missing:latest');
  await page.goto('/');
  await question.fill('Como listar produtos quando o modelo está ausente?');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await expect(page.getByRole('status', { name: 'Limitações da resposta' })).toContainText('Resposta produzida sem LLM: O modelo speclens-e2e-missing:latest não está disponível no Ollama local.', { timeout: 20_000 });
  await expect(page.getByText('/e2e-products').first()).toBeVisible();

  modelRequests = await (await request.get(`${fakeOllamaUrl}/__test/model-requests`)).json();
  expect(modelRequests.models).not.toContain('speclens-e2e-missing:latest');
  expect(externalRequests).toEqual([]);
});
