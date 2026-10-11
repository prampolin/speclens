'use client';

import { useState } from 'react';
import { Send, Sparkles, Check, Copy, Info, Terminal, Code2 } from 'lucide-react';
import type { SourceCitation } from '@speclens/ai-core';

interface ChatAreaProps {
  onOpenInspector: (citation: SourceCitation) => void;
  isInspectorOpen: boolean;
}

export function ChatArea({ onOpenInspector, isInspectorOpen: _isInspectorOpen }: ChatAreaProps) {
  const [prompt, setPrompt] = useState('');
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'fetch' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  const sampleCitation: SourceCitation = {
    specificationId: 'spec-1',
    operationId: 'createCatalogItem',
    method: 'POST',
    path: '/v1/catalog/items',
    sourcePointer: '#/paths/~1v1~1catalog~1items/post',
  };

  const sampleSnippets = {
    curl: `curl -X POST "http://localhost:8080/v1/catalog/items" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Produto com desconto",
    "discountPercent": 15
  }'`,
    fetch: `const response = await fetch('http://localhost:8080/v1/catalog/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Produto com desconto',
    discountPercent: 15,
  }),
});
const data = await response.json();`,
    python: `import requests

url = "http://localhost:8080/v1/catalog/items"
payload = {
    "name": "Produto com desconto",
    "discountPercent": 15
}
headers = {"Content-Type": "application/json"}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-background">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
        {/* Assistant Welcome Message */}
        <div className="bg-card/60 border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">SpecLens Assistant</h2>
              <p className="text-xs text-muted-foreground">
                Local-first · Contratos OpenAPI Canônicos · Private Mode Ativo
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-foreground/90">
            Pergunte sobre qualquer endpoint em linguagem natural (Português ou Inglês). Toda
            resposta é grounded no OpenAPI carregado e não sai da sua máquina.
          </p>

          {/* Processing Stages Indicators */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60 text-[11px]">
            <span className="bg-accent/40 border border-border px-2.5 py-1 rounded-md text-muted-foreground flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Laya Classifier: Local</span>
            </span>
            <span className="bg-accent/40 border border-border px-2.5 py-1 rounded-md text-muted-foreground flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>FTS5 + Vector Retrieval: Pronto</span>
            </span>
            <span className="bg-accent/40 border border-border px-2.5 py-1 rounded-md text-muted-foreground flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Ollama: 127.0.0.1</span>
            </span>
          </div>
        </div>

        {/* Sample grounded query and answer */}
        <div className="space-y-4">
          {/* User message */}
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground text-xs px-4 py-2.5 rounded-xl rounded-tr-sm max-w-md">
              Como cadastro um produto com desconto de 15%?
            </div>
          </div>

          {/* Assistant grounded response */}
          <div className="bg-card/70 border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resposta Grounded</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">schemaVersion: 1</span>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed">
              Para cadastrar um produto com desconto, utilize a operação{' '}
              <strong className="font-mono text-primary font-semibold">
                POST /v1/catalog/items
              </strong>
              . O corpo da requisição aceita a propriedade obrigatória{' '}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">name</code> e a propriedade
              opcional{' '}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">discountPercent</code>.
            </p>

            {/* Citations badges */}
            <div className="pt-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Endpoints Citados (Clique para inspecionar)
              </label>
              <button
                onClick={() => onOpenInspector(sampleCitation)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-accent/50 border border-border hover:border-primary/60 transition text-xs group"
              >
                <span className="font-mono font-bold text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                  {sampleCitation.method}
                </span>
                <span className="font-mono text-foreground font-medium">{sampleCitation.path}</span>
                <Info className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition ml-1" />
              </button>
            </div>

            {/* Code Snippets Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex space-x-1 bg-muted/60 p-0.5 rounded-md text-xs">
                  <button
                    onClick={() => setActiveSnippetTab('curl')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1 transition ${
                      activeSnippetTab === 'curl'
                        ? 'bg-background text-foreground font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Terminal className="w-3 h-3" />
                    <span>cURL</span>
                  </button>
                  <button
                    onClick={() => setActiveSnippetTab('fetch')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1 transition ${
                      activeSnippetTab === 'fetch'
                        ? 'bg-background text-foreground font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>fetch</span>
                  </button>
                  <button
                    onClick={() => setActiveSnippetTab('python')}
                    className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1 transition ${
                      activeSnippetTab === 'python'
                        ? 'bg-background text-foreground font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Python</span>
                  </button>
                </div>

                <button
                  onClick={() => handleCopy(sampleSnippets[activeSnippetTab])}
                  className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-black/60 border border-border/80 rounded-lg overflow-x-auto font-mono text-xs text-foreground/90">
                <pre>{sampleSnippets[activeSnippetTab]}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border bg-card/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPrompt('');
          }}
          className="max-w-4xl mx-auto flex items-center space-x-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pergunte sobre um endpoint ou contrato..."
            className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 transition"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
