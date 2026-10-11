'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  ExternalLink,
  Shield,
  Database,
  Cpu,
} from 'lucide-react';
import { useChat, type SnippetItem } from './ChatContext';

export function ChatArea() {
  const {
    messages,
    sendMessage,
    isStreaming,
    isIndexing,
    openInspector,
    activeSpecId,
    specifications,
  } = useChat();

  const [inputQuery, setInputQuery] = useState('');
  const [activeSnippetTabs, setActiveSnippetTabs] = useState<Record<string, string>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSpec = specifications.find((s) => s.id === activeSpecId);

  // Auto scroll to bottom as tokens arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isStreaming || isIndexing) return;

    sendMessage(inputQuery);
    setInputQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = (snippetId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedMap((prev) => ({ ...prev, [snippetId]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [snippetId]: false }));
    }, 2000);
  };

  const getActiveTab = (messageId: string, snippets: SnippetItem[]) => {
    if (activeSnippetTabs[messageId]) {
      return activeSnippetTabs[messageId];
    }
    return snippets[0]?.language || 'curl';
  };

  const setActiveTab = (messageId: string, lang: string) => {
    setActiveSnippetTabs((prev) => ({ ...prev, [messageId]: lang }));
  };

  return (
    <main
      role="main"
      aria-label="Área de conversação e consulta de especificações"
      className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-background select-none"
    >
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
        {/* Welcome Banner */}
        <div className="bg-card/60 border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">SpecLens Assistant</h1>
              <p className="text-xs text-muted-foreground">
                Local-first · Contratos OpenAPI Canônicos · Private Mode Ativo
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-foreground/90">
            Pergunte sobre qualquer endpoint em linguagem natural (Português ou Inglês). Toda
            resposta é estritamente fundamentada no OpenAPI local carregado, com proveniência e snippets auditáveis.
          </p>

          {/* Active Spec Info */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-[11px]">
            <span className="bg-accent/40 border border-border px-2.5 py-1 rounded-md text-muted-foreground flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Spec Ativa:</span>
              <strong className="text-foreground font-mono">
                {activeSpec ? `${activeSpec.title} (${activeSpec.version})` : 'Nenhuma selecionada'}
              </strong>
            </span>
            <span className="bg-accent/40 border border-border px-2.5 py-1 rounded-md text-muted-foreground flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo Privado: Fail-Closed</span>
            </span>
          </div>
        </div>

        {/* Message Stream List */}
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="bg-primary text-primary-foreground text-xs px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-lg shadow-sm">
                  {message.content}
                </div>
              </div>
            );
          }

          // Assistant Message
          const isProcessing = message.stage && message.stage !== 'done';
          const snippets = message.snippets || [];
          const activeLanguage = getActiveTab(message.id, snippets);
          const currentSnippet = snippets.find(
            (s) => s.language.toLowerCase() === activeLanguage.toLowerCase()
          );

          return (
            <div
              key={message.id}
              className="bg-card/70 border border-border rounded-xl p-5 shadow-sm space-y-4"
            >
              {/* Processing Stages Indicators */}
              {isProcessing && (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-3 rounded-lg bg-accent/40 border border-border space-y-2 text-xs"
                >
                  <div className="flex items-center space-x-2 text-primary font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{message.statusMessage || 'Processando consulta...'}</span>
                  </div>

                  {/* Pipeline Steps Badges */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded border flex items-center space-x-1 ${
                        message.stage === 'classifying'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800 animate-pulse'
                          : message.intent
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <Cpu className="w-3 h-3" />
                      <span>Classificando intenção</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded border flex items-center space-x-1 ${
                        message.stage === 'retrieving'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800 animate-pulse'
                          : message.retrievalResults
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <Database className="w-3 h-3" />
                      <span>Buscando operações</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded border flex items-center space-x-1 ${
                        message.stage === 'explaining'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800 animate-pulse'
                          : message.content
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gerando explicação</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Streaming Content (with aria-live) */}
              {message.content && (
                <div
                  aria-live="polite"
                  aria-atomic="false"
                  className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-foreground"
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              )}

              {/* Error Message with role="alert" */}
              {message.error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs space-y-1"
                >
                  <div className="flex items-center space-x-1.5 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Erro ({message.error.code})</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{message.error.message}</p>
                </div>
              )}

              {/* Clickable Citations (Sources) */}
              {message.sources && message.sources.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Fontes OpenAPI Citadas (Clique para inspecionar):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {message.sources.map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => openInspector(src, message.retrievalResults)}
                        className="group flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-accent/40 border border-border hover:border-primary/60 hover:bg-accent/70 transition text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                        title={`Inspecionar contrato de ${src.method} ${src.path}`}
                      >
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono uppercase ${
                            src.method?.toLowerCase() === 'get'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : src.method?.toLowerCase() === 'post'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {src.method}
                        </span>
                        <span className="font-mono text-[11px] text-foreground font-medium">
                          {src.path}
                        </span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Snippets with Shiki syntax highlighting */}
              {snippets.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    {/* Language Selector */}
                    <div className="flex items-center space-x-1" role="tablist">
                      {snippets.map((snip) => {
                        const isTabActive =
                          snip.language.toLowerCase() === activeLanguage.toLowerCase();
                        return (
                          <button
                            key={snip.language}
                            type="button"
                            role="tab"
                            aria-selected={isTabActive}
                            onClick={() => setActiveTab(message.id, snip.language)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-primary ${
                              isTabActive
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {snip.label || snip.language}
                          </button>
                        );
                      })}
                    </div>

                    {/* Copy Snippet Button (Copy only - NO execution) */}
                    {currentSnippet && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(`${message.id}-${activeLanguage}`, currentSnippet.code)
                        }
                        className="flex items-center space-x-1 px-2 py-1 rounded text-[11px] bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground transition focus:outline-none focus:ring-1 focus:ring-primary"
                        title="Copiar código para a área de transferência"
                        aria-label="Copiar código"
                      >
                        {copiedMap[`${message.id}-${activeLanguage}`] ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Code Container with Shiki HTML or fallback */}
                  {currentSnippet && (
                    <div className="rounded-lg overflow-hidden border border-border bg-[#0d1117] text-xs font-mono">
                      {currentSnippet.html ? (
                        <div
                          className="p-3 overflow-x-auto text-[11px] leading-relaxed [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0"
                          dangerouslySetInnerHTML={{ __html: currentSnippet.html }}
                        />
                      ) : (
                        <pre className="p-3 overflow-x-auto text-[11px] text-zinc-100">
                          <code>{currentSnippet.code}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card/60">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || isIndexing}
              placeholder={
                isIndexing
                  ? 'Reconstruindo índice local... Envio bloqueado.'
                  : 'Faça uma pergunta sobre a API (ex: "como listar produtos", "list all pets")...'
              }
              aria-label="Pergunta sobre a especificação OpenAPI"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed resize-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={!inputQuery.trim() || isStreaming || isIndexing}
            aria-label="Enviar pergunta"
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 shadow-sm"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
