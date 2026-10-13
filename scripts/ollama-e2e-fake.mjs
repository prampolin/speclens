import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';

const readyFile = process.env.SPECLENS_FAKE_OLLAMA_READY_FILE;
if (!readyFile) throw new Error('SPECLENS_FAKE_OLLAMA_READY_FILE is required');

const models = new Set(['speclens-e2e-a:latest', 'speclens-e2e-b:latest']);
const requestedModels = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    response.end(JSON.stringify({ models: [...models].map((name) => ({ name, details: {} })) }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/__test/model-requests') {
    response.end(JSON.stringify({ models: requestedModels }));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    requestedModels.push(payload.model);
    if (!models.has(payload.model)) {
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'model not found' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    response.end([
      JSON.stringify({ model: payload.model, message: { role: 'assistant', content: 'Mock Ollama explanation grounded in the imported contract.' }, done: false }),
      JSON.stringify({ model: payload.model, message: { role: 'assistant', content: '' }, done: true }),
      '',
    ].join('\n'));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: 'not found' }));
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind mock Ollama server');
  writeFileSync(readyFile, JSON.stringify({ port: address.port }));
});

function close() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
