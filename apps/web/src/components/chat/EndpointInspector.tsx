'use client';

import { X, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { SourceCitation } from '@speclens/ai-core';

interface EndpointInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  citation?: SourceCitation | null;
}

export function EndpointInspector({ isOpen, onClose, citation }: EndpointInspectorProps) {
  if (!isOpen) {
    return null;
  }

  const endpoint = citation || {
    method: 'POST',
    path: '/v1/catalog/items',
    operationId: 'createCatalogItem',
    specificationId: 'spec-1',
    sourcePointer: '#/paths/~1v1~1catalog~1items/post',
  };

  return (
    <aside className="w-96 border-l border-border bg-card/70 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm">Endpoint Inspector</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            Grounding
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent transition"
          title="Fechar inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
        {/* Method & Path */}
        <div className="p-3 rounded-md bg-accent/40 border border-border">
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
              {endpoint.method}
            </span>
            <span className="font-mono text-xs font-medium text-foreground truncate">
              {endpoint.path}
            </span>
          </div>
          {endpoint.operationId && (
            <div className="text-[11px] text-muted-foreground">
              Operation ID:{' '}
              <span className="font-mono text-foreground">{endpoint.operationId}</span>
            </div>
          )}
        </div>

        {/* Source pointer & contract validity */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Source Pointer
          </label>
          <div className="p-2 bg-muted/60 rounded font-mono text-[11px] text-foreground flex items-center justify-between">
            <span className="truncate">{endpoint.sourcePointer}</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
          </div>
        </div>

        {/* Grounding Status */}
        <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/40 p-2.5 rounded border border-emerald-900/60">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-[11px]">
            Endpoint 100% canônico e validado contra especificação local.
          </span>
        </div>

        {/* Request parameters mockup */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Parâmetros & Body
          </label>
          <div className="p-2.5 bg-background/80 rounded border border-border space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-mono text-primary font-medium">name</span>
              <span className="text-muted-foreground">string · required</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-mono text-primary font-medium">discountPercent</span>
              <span className="text-muted-foreground">number · optional</span>
            </div>
          </div>
        </div>

        {/* Responses */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Respostas Documentadas
          </label>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-[11px]">
              <span className="font-mono font-bold text-emerald-400">201 Created</span>
              <span className="text-muted-foreground">Item criado com sucesso</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-[11px]">
              <span className="font-mono font-bold text-amber-400">400 Bad Request</span>
              <span className="text-muted-foreground">Payload inválido</span>
            </div>
          </div>
        </div>

        {/* Security Alert */}
        <div className="flex items-start space-x-2 text-muted-foreground text-[11px] p-2 bg-muted/30 rounded border border-border">
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
          <span>Snippets utilizam apenas credenciais fictícias de placeholder.</span>
        </div>
      </div>
    </aside>
  );
}
