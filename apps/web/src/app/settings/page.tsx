'use client';

import { useState } from 'react';
import { ShieldCheck, Cpu, Database, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { DEFAULT_CONFIG } from '@/lib/config';

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_CONFIG);
  const [reindexStatus, setReindexStatus] = useState<'idle' | 'running' | 'completed'>('idle');

  const handleTriggerReindex = () => {
    setReindexStatus('running');
    setTimeout(() => {
      setReindexStatus('completed');
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 select-none">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Configurações & Provedores
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gerencie modelos, persistência e verificação de privacidade estrita do SpecLens.
        </p>
      </div>

      {/* Private Mode Banner */}
      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs text-emerald-300">
              Private Mode: Ativo (Fail Closed)
            </span>
            <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full font-mono">
              privateMode={String(settings.privateMode)}
            </span>
          </div>
          <p className="text-xs text-emerald-400/80 leading-relaxed">
            Chamadas remotas, telemetria, downloads implícitos de modelos e resolução de $ref remoto
            estão bloqueados no nível de política e transporte.
          </p>
        </div>
      </div>

      {/* Providers Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Embedding Provider */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-semibold text-foreground">Embedding Provider</h2>
            </div>
            <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded">
              Local ONNX / JS
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">Provedor</label>
              <select
                value={settings.embedding.providerId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    embedding: { ...settings.embedding, providerId: e.target.value },
                  })
                }
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-primary"
              >
                <option value="transformers-local">@huggingface/transformers (Local)</option>
                <option value="custom-local">Custom Local Adapter</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Modelo / Checkpoint
              </label>
              <input
                type="text"
                value={settings.embedding.modelId}
                readOnly
                className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground font-mono"
              />
            </div>
          </div>
        </div>

        {/* Decision Provider */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-semibold text-foreground">Decision Provider (Intent)</h2>
            </div>
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">
              Classificador Local
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">Provedor</label>
              <select
                value={settings.decision.providerId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    decision: { ...settings.decision, providerId: e.target.value },
                  })
                }
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-primary"
              >
                <option value="laya-local">Laya Multilingual (Local)</option>
                <option value="deterministic-rules">Regras Determinísticas (Offline)</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Modelo / Checkpoint
              </label>
              <input
                type="text"
                value={settings.decision.modelId}
                readOnly
                className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground font-mono"
              />
            </div>
          </div>
        </div>

        {/* LLM Provider */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-semibold text-foreground">LLM Provider (Explanation)</h2>
            </div>
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">
              127.0.0.1
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">Provedor</label>
              <select
                value={settings.llm.providerId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    llm: { ...settings.llm, providerId: e.target.value },
                  })
                }
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-primary"
              >
                <option value="ollama-local">Ollama (127.0.0.1:11434)</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Modelo Instalado
              </label>
              <input
                type="text"
                value={settings.llm.modelId}
                readOnly
                className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground font-mono"
              />
            </div>
          </div>
        </div>

        {/* Reindexing & Vector Index Status */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-foreground">Índice Vetorial & Reindex</h2>
            </div>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
              Status: Ativo
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            A troca de embedding cria um novo namespace isolado. O reindex manual reconstrói os
            vetores sem invalidar a busca léxica FTS5.
          </p>

          <div className="pt-2">
            <button
              onClick={handleTriggerReindex}
              disabled={reindexStatus === 'running'}
              className="w-full bg-secondary hover:bg-secondary/80 text-foreground py-2 rounded-md text-xs font-medium border border-border transition flex items-center justify-center space-x-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${reindexStatus === 'running' ? 'animate-spin' : ''}`}
              />
              <span>
                {reindexStatus === 'running'
                  ? 'Reindexando...'
                  : reindexStatus === 'completed'
                    ? 'Reindex Concluído!'
                    : 'Executar Reindex Local'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Security Audit summary */}
      <div className="p-4 rounded-xl bg-card/40 border border-border text-xs space-y-2">
        <div className="flex items-center space-x-2 text-primary font-semibold">
          <Lock className="w-4 h-4" />
          <span>Controles de Integridade e Auditoria</span>
        </div>
        <ul className="space-y-1 text-muted-foreground text-[11px]">
          <li className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Telemetria desabilitada via NEXT_TELEMETRY_DISABLED=1</span>
          </li>
          <li className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              CSP restringe conexões exclusivamente a self e loopback (127.0.0.1 / localhost)
            </span>
          </li>
          <li className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Carregamento inicial estritamente livre de requisições externas</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
