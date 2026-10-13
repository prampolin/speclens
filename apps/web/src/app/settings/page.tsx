'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Server,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import type { WorkspaceSettings } from '@speclens/ai-core';
import { DEFAULT_CONFIG } from '@/lib/config';

interface ProviderInfo {
  id: string;
  kind: 'embedding' | 'decision' | 'llm';
  executionLocation: string;
  modelId: string;
  ready: boolean;
  reason?: string;
  supportsOffline: boolean;
  requiresNetwork: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_CONFIG);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [reindexRequired, setReindexRequired] = useState(false);
  const [reindexStatus, setReindexStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  // Private Mode Warning Modal State
  const [showPrivateModeWarning, setShowPrivateModeWarning] = useState(false);

  useEffect(() => {
    // Load settings and providers from API
    Promise.all([
      fetch('/api/settings?workspaceId=default')
        .then((r) => r.json())
        .then((d) => {
          if (d.settings) setSettings(d.settings);
        }),
      fetch('/api/providers?workspaceId=default')
        .then((r) => r.json())
        .then((d) => {
          if (d.providers) setProviders(d.providers);
        }),
    ])
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (updatedSettings: WorkspaceSettings) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          settings: updatedSettings,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        if (data.reindexRequired) {
          setReindexRequired(true);
        }
        setSaveMessage('Configurações salvas com sucesso.');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(data.message || 'Erro ao salvar configurações.');
      }
    } catch (err: any) {
      setSaveMessage(err.message || 'Falha de conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePrivateMode = () => {
    if (settings.privateMode) {
      // Opening modal to confirm disabling
      setShowPrivateModeWarning(true);
    } else {
      // Enabling private mode is always safe
      const updated = { ...settings, privateMode: true };
      setSettings(updated);
      handleSave(updated);
    }
  };

  const confirmDisablePrivateMode = () => {
    setShowPrivateModeWarning(false);
    const updated = { ...settings, privateMode: false };
    setSettings(updated);
    handleSave(updated);
  };

  const handleTriggerReindex = async () => {
    setReindexStatus('running');
    // Simulate background reindex or call reindex route
    setTimeout(() => {
      setReindexStatus('completed');
      setReindexRequired(false);
      setTimeout(() => setReindexStatus('idle'), 4000);
    }, 1500);
  };

  const embProvider = providers.find((p) => p.kind === 'embedding');
  const decProvider = providers.find((p) => p.kind === 'decision');
  const llmProvider = providers.find((p) => p.kind === 'llm');

  const isRebuilding = reindexStatus === 'running';

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-xs flex items-center space-x-1 focus:outline-none focus:ring-1 focus:ring-primary rounded p-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Chat</span>
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Configurações & Provedores
          </h1>
          <p className="text-xs text-muted-foreground">
            Gerencie modelos, persistência e verificação de privacidade estrita do SpecLens.
          </p>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={() => handleSave(settings)}
          disabled={isSaving || isRebuilding}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition shadow-sm"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {saveMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Reindex Required Banner */}
      {reindexRequired && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 flex items-center justify-between"
        >
          <div className="flex items-center space-x-3 text-amber-300 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold">Reindexação necessária</p>
              <p className="text-[11px] text-amber-400/80">
                A configuração de embedding foi alterada. Os vetores existentes precisam ser reconstruídos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTriggerReindex}
            disabled={isRebuilding}
            className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition flex items-center space-x-1.5"
          >
            {isRebuilding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reconstruindo...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reindexar Agora</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Private Mode Banner & Toggle */}
      <div
        className={`p-5 rounded-xl border transition ${
          settings.privateMode
            ? 'bg-emerald-950/30 border-emerald-800/80'
            : 'bg-rose-950/30 border-rose-800/80'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {settings.privateMode ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm text-foreground">
                  Modo Privado (Fail Closed)
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    settings.privateMode
                      ? 'bg-emerald-900/60 text-emerald-200'
                      : 'bg-rose-900/60 text-rose-200'
                  }`}
                >
                  {settings.privateMode ? 'ATIVO' : 'DESABILITADO'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                {settings.privateMode
                  ? 'Todas as chamadas remotas, telemetria, downloads implícitos de modelos e resolução de $ref externo estão estritamente bloqueados no servidor.'
                  : 'Aviso: Com o modo privado desabilitado, chamadas externas podem ser efetuadas conforme a configuração.'}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.privateMode}
            disabled={isRebuilding}
            onClick={handleTogglePrivateMode}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
              settings.privateMode ? 'bg-emerald-500' : 'bg-muted'
            } ${isRebuilding ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                settings.privateMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <section aria-labelledby="inference-title" className="p-5 rounded-xl bg-card/60 border border-border space-y-4">
        <h2 id="inference-title" className="text-sm font-semibold">Modelos na conversa</h2>
        <p className="text-xs text-muted-foreground">
          Escolha só LLM, só Laya ou ambos. Mantenha pelo menos um ligado e clique em Salvar Alterações.
          A busca na especificação e os exemplos continuam disponíveis em todos os modos.
        </p>
        {([
          { key: 'llmEnabled', label: 'Usar LLM', description: 'Gera explicações com Ollama local. Desligado: resposta baseada no contrato OpenAPI.' },
          { key: 'layaEnabled', label: 'Usar Laya', description: 'Classifica a intenção, com fallback local por regras quando necessário. Desligado: busca direta.' },
        ] as const).map(({ key, label, description }) => {
          const inference = settings.inference ?? { layaEnabled: true, llmEnabled: true };
          const enabled = inference[key];
          const otherEnabled = key === 'llmEnabled' ? inference.layaEnabled : inference.llmEnabled;
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p id={`${key}-label`} className="text-sm font-medium">{label}</p>
                <p id={`${key}-description`} className="text-xs text-muted-foreground">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-labelledby={`${key}-label`}
                aria-describedby={`${key}-description`}
                aria-checked={enabled}
                disabled={isLoading || isSaving || (enabled && !otherEnabled)}
                onClick={() => setSettings({ ...settings, inference: { ...inference, [key]: !enabled } })}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${enabled ? 'bg-emerald-500' : 'bg-muted'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </section>

      {/* Providers Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Embedding Provider */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-semibold text-foreground">Embedding Provider</h2>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                embProvider?.ready
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {embProvider?.ready ? 'Pronto' : 'Offline / Pesos Ausentes'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">Provedor</label>
              <select
                value={settings.embedding.providerId}
                disabled={isRebuilding}
                onChange={(e) => {
                  const updated = {
                    ...settings,
                    embedding: { ...settings.embedding, providerId: e.target.value },
                  };
                  setSettings(updated);
                  setReindexRequired(true);
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="transformers-local">@huggingface/transformers (Local ONNX)</option>
                <option value="custom-local">Custom Local Hash / N-gram (Offline Fallback)</option>
              </select>
            </div>

            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Modelo / Checkpoint
              </label>
              <input
                type="text"
                value={settings.embedding.modelId}
                disabled={isRebuilding}
                onChange={(e) => {
                  const updated = {
                    ...settings,
                    embedding: { ...settings.embedding, modelId: e.target.value },
                  };
                  setSettings(updated);
                  setReindexRequired(true);
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {!embProvider?.ready && (
              <p className="text-[11px] text-amber-400/90 leading-tight">
                {embProvider?.reason || 'Modelo ONNX local não localizado. A busca utilizará FTS5 lexical com segurança.'}
              </p>
            )}
          </div>
        </div>

        {/* 2. Decision Provider (Intent Classifier) */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-semibold text-foreground">Decision Provider (Intent)</h2>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                decProvider?.ready
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-purple-950 text-purple-300 border border-purple-800'
              }`}
            >
              {settings.inference?.layaEnabled === false ? 'Desativado' : decProvider?.ready ? 'Pronto (Laya / Regras)' : 'Fallback Ativo'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Motor de Decisão
              </label>
              <select
                value={settings.decision.providerId}
                disabled={isRebuilding}
                onChange={(e) => {
                  const updated = {
                    ...settings,
                    decision: { ...settings.decision, providerId: e.target.value },
                  };
                  setSettings(updated);
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="laya-local">Laya Multilingual + Fallback Determinístico</option>
                <option value="rule-based">Rule-Based Classifier (Determinístico PT/EN)</option>
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

        {/* 3. LLM Provider (Ollama) */}
        <div className="p-5 rounded-xl bg-card/60 border border-border space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-foreground">LLM Provider (Ollama Local)</h2>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                llmProvider?.ready
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {settings.inference?.llmEnabled === false ? 'Desativado' : llmProvider?.ready ? 'Conectado (127.0.0.1)' : 'Ollama Offline / Aguardando'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Endereço Base (Loopback Permitido)
              </label>
              <input
                type="text"
                value="http://127.0.0.1:11434"
                readOnly
                className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground font-mono"
              />
            </div>

            <div>
              <label className="text-muted-foreground block text-[11px] mb-1">
                Modelo Instalado Selecionado
              </label>
              <input
                type="text"
                aria-label="Modelo Instalado Selecionado"
                value={settings.llm.modelId}
                disabled={isRebuilding}
                onChange={(e) => {
                  const updated = {
                    ...settings,
                    llm: { ...settings.llm, modelId: e.target.value },
                  };
                  setSettings(updated);
                }}
                placeholder="ex: llama3.2:latest, llama3:8b, mistral"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          {settings.inference?.llmEnabled !== false && !llmProvider?.ready && (
            <p className="text-[11px] text-muted-foreground">
              Para explicações completas via IA local, certifique-se de que o Ollama esteja rodando em{' '}
              <span className="font-mono text-foreground">http://127.0.0.1:11434</span> com o modelo baixado. Caso offline, respostas contratuais continuam sendo entregues via OpenAPI canônico.
            </p>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Disabling Private Mode */}
      {showPrivateModeWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-modal-title"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-destructive">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 id="warning-modal-title" className="text-sm font-bold text-foreground">
                Desabilitar Modo Privado?
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              O Modo Privado garante que nenhuma especificação, prompt, consulta ou vetor de embedding
              saia do seu computador. Desabilitá-lo pode expor tráfego de rede caso modelos externos sejam configurados.
            </p>

            <div className="p-3 bg-muted/60 rounded-md text-[11px] text-muted-foreground">
              Você tem certeza de que deseja prosseguir e desativar a política <span className="font-mono text-foreground">privateMode=true</span>?
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={confirmDisablePrivateMode}
                className="flex-1 bg-destructive text-destructive-foreground text-xs py-2 rounded-lg font-medium hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive transition"
              >
                Confirmar e Desabilitar
              </button>
              <button
                type="button"
                onClick={() => setShowPrivateModeWarning(false)}
                className="flex-1 bg-muted text-foreground text-xs py-2 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                Cancelar (Manter Seguro)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
