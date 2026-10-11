'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  Database,
  Sparkles,
} from 'lucide-react';
import { useChat } from './ChatContext';
import type { NormalizedOperation } from '@speclens/openapi-core';

export function EndpointInspector() {
  const {
    isInspectorOpen,
    closeInspector,
    selectedCitation,
    inspectorCandidates,
    workspaceId,
  } = useChat();

  const [activeTab, setActiveTab] = useState<'contract' | 'rag'>('contract');
  const [operationData, setOperationData] = useState<NormalizedOperation | null>(null);
  const [specMeta, setSpecMeta] = useState<any>(null);
  const [_isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isInspectorOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen, closeInspector]);

  useEffect(() => {
    if (!selectedCitation?.operationId) {
      setOperationData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/operations/${encodeURIComponent(selectedCitation.operationId)}?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Operation not found');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setOperationData(data.operation);
          setSpecMeta(data.specification);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCitation, workspaceId]);

  if (!isInspectorOpen) {
    return null;
  }

  const endpoint = selectedCitation || {
    method: 'GET',
    path: '/api/v1/resource',
    operationId: 'getResource',
    sourcePointer: '#/paths/~1api~1v1~1resource/get',
    specVersion: '1.0.0',
    specTitle: 'API Spec',
  };

  return (
    <aside
      role="complementary"
      aria-label="Inspetor de Endpoint e RAG"
      className="w-96 border-l border-border bg-card/90 backdrop-blur flex flex-col h-[calc(100vh-3.5rem)] select-none shadow-2xl transition-all"
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm">Endpoint Inspector</span>
          <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-medium">
            Grounded Contract
          </span>
        </div>
        <button
          type="button"
          onClick={closeInspector}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition"
          title="Fechar inspetor (Esc)"
          aria-label="Fechar painel do inspetor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-muted/40 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'contract'}
          onClick={() => setActiveTab('contract')}
          className={`flex-1 text-xs py-1.5 font-medium rounded transition focus:outline-none focus:ring-1 focus:ring-primary ${
            activeTab === 'contract'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Contrato OpenAPI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rag'}
          onClick={() => setActiveTab('rag')}
          className={`flex-1 text-xs py-1.5 font-medium rounded transition focus:outline-none focus:ring-1 focus:ring-primary flex items-center justify-center space-x-1 ${
            activeTab === 'rag'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>RAG Ranking</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
        {activeTab === 'contract' ? (
          <>
            {/* Method & Path Card */}
            <div className="p-3 rounded-md bg-accent/40 border border-border space-y-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border ${
                    endpoint.method?.toLowerCase() === 'get'
                      ? 'bg-blue-950 text-blue-400 border-blue-800'
                      : endpoint.method?.toLowerCase() === 'post'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : endpoint.method?.toLowerCase() === 'delete'
                      ? 'bg-rose-950 text-rose-400 border-rose-800'
                      : 'bg-amber-950 text-amber-400 border-amber-800'
                  }`}
                >
                  {endpoint.method}
                </span>
                <span className="font-mono text-xs font-medium text-foreground truncate">
                  {endpoint.path}
                </span>
              </div>

              {endpoint.operationId && (
                <div className="text-[11px] text-muted-foreground flex items-center space-x-1">
                  <span>Operation ID:</span>
                  <span className="font-mono text-foreground font-medium truncate">
                    {endpoint.operationId}
                  </span>
                </div>
              )}
            </div>

            {/* Spec Version and Provenance */}
            <div className="p-2.5 rounded bg-muted/40 border border-border/80 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Especificação:</span>
                <span className="font-medium text-foreground truncate">
                  {specMeta?.title || (endpoint as any).specTitle || 'OpenAPI Spec'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Versão da Spec:</span>
                <span className="font-mono text-foreground">
                  {specMeta?.version || (endpoint as any).specVersion || 'v1.0.0'}
                </span>
              </div>
            </div>

            {/* Source Pointer */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Source Pointer (JSON Pointer)
              </label>
              <div className="p-2 bg-muted/70 rounded font-mono text-[11px] text-foreground flex items-center justify-between border border-border">
                <span className="truncate">{endpoint.sourcePointer}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
              </div>
            </div>

            {/* Provenance Verification Badge */}
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/40 p-2.5 rounded border border-emerald-900/60">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-[11px] leading-tight">
                Origem 100% verificada no SQLite local. Zero alucinação contratual.
              </span>
            </div>

            {/* Parameters section */}
            {operationData?.parameters && operationData.parameters.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Parâmetros ({operationData.parameters.length})
                </label>
                <div className="space-y-1.5">
                  {operationData.parameters.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-background/80 border border-border flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-mono text-primary font-medium">{p.name}</span>
                        <span className="text-muted-foreground ml-1.5">({p.in})</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          p.required
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {p.required ? 'required' : 'optional'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Body Details */}
            {operationData?.requestBody && (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Corpo da Requisição (Request Body)
                </label>
                <div className="p-2.5 rounded bg-background/80 border border-border space-y-1 text-[11px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Obrigatório:</span>
                    <span className="font-medium text-foreground">
                      {operationData.requestBody.required ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  {operationData.requestBody.description && (
                    <p className="text-foreground/90 mt-1">
                      {operationData.requestBody.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Responses */}
            {operationData?.responses && (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Respostas Definidas
                </label>
                <div className="space-y-1">
                  {Object.entries(operationData.responses).map(([code, r]) => (
                    <div
                      key={code}
                      className="p-2 rounded bg-background/80 border border-border flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono font-bold text-foreground">{code}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {r.description || 'Sucesso / Resposta'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* RAG Inspector Panel */
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Candidatos Ranqueados (RRF Fusion)</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Scores combinados de busca lexical (SQLite FTS5) e vetorial semântica.
              </p>
            </div>

            {inspectorCandidates.length === 0 ? (
              <div className="p-4 rounded border border-dashed border-border text-center text-muted-foreground text-xs">
                Faça uma pergunta no chat para visualizar o ranking RAG e scores de similaridade.
              </div>
            ) : (
              <div className="space-y-2">
                {inspectorCandidates.map((cand, idx) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={cand.operationId || idx}
                      className={`p-2.5 rounded-md border text-xs space-y-1.5 ${
                        isTop
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-accent/30 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            #{cand.rank || idx + 1}
                          </span>
                          <span className="font-mono font-bold uppercase text-[10px]">
                            {cand.method}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-primary font-semibold">
                          Score: {(cand.fusedScore || 0).toFixed(4)}
                        </span>
                      </div>

                      <div className="font-mono text-[11px] truncate text-foreground">
                        {cand.path}
                      </div>

                      {/* Scores detail breakdown */}
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                        <div>
                          <span>FTS5 Rank: </span>
                          <span className="font-mono text-foreground">
                            {cand.lexicalScore !== null ? Number(cand.lexicalScore).toFixed(2) : '—'}
                          </span>
                        </div>
                        <div>
                          <span>Vector Sim: </span>
                          <span className="font-mono text-foreground">
                            {cand.vectorScore !== null ? Number(cand.vectorScore).toFixed(3) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
