'use client';

import React, { useRef, useState } from 'react';
import {
  Layers,
  FileCode,
  Filter,
  Plus,
  ChevronDown,
  Trash2,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useChat } from './ChatContext';

export function Sidebar() {
  const {
    workspaceId,
    setWorkspaceId,
    workspaces,
    createWorkspace,
    deleteWorkspace,
    specifications,
    activeSpecId,
    setActiveSpecId,
    uploadSpecification,
    isIndexing,
    indexingProgress,
    filterMethod,
    setFilterMethod,
  } = useChat();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [newWsTitle, setNewWsTitle] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Extract available tags from current active spec (if any)
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId) || {
    id: workspaceId,
    title: 'Workspace',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const result = await uploadSpecification(file);
    if (!result.success) {
      setUploadError(result.message || 'Falha ao importar OpenAPI');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsTitle.trim()) return;
    await createWorkspace(newWsTitle.trim());
    setNewWsTitle('');
    setIsCreatingWs(false);
    setIsWorkspaceMenuOpen(false);
  };

  return (
    <aside
      aria-label="Barra lateral de especificações e filtros"
      className="w-72 border-r border-border bg-card/40 flex flex-col h-[calc(100vh-3.5rem)] select-none"
    >
      {/* Workspace Selector */}
      <div className="p-3 border-b border-border relative">
        <label
          id="workspace-label"
          className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
        >
          Workspace
        </label>
        <button
          type="button"
          aria-labelledby="workspace-label"
          aria-expanded={isWorkspaceMenuOpen}
          aria-haspopup="listbox"
          disabled={isIndexing}
          onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded bg-accent/40 border border-border text-sm hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center space-x-2 truncate">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium truncate">{currentWorkspace.title}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>

        {/* Workspace Dropdown */}
        {isWorkspaceMenuOpen && (
          <div
            role="listbox"
            className="absolute top-full left-3 right-3 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 p-2 space-y-1"
          >
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer ${
                    ws.id === workspaceId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                  }`}
                  onClick={() => {
                    setWorkspaceId(ws.id);
                    setIsWorkspaceMenuOpen(false);
                  }}
                >
                  <span className="truncate">{ws.title}</span>
                  {ws.id !== 'default' && (
                    <button
                      type="button"
                      title="Excluir workspace"
                      aria-label={`Excluir workspace ${ws.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir workspace "${ws.title}"? Todos os dados locais serão apagados.`)) {
                          deleteWorkspace(ws.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Create Workspace Button or Form */}
            <div className="pt-2 border-t border-border mt-1">
              {isCreatingWs ? (
                <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-1.5">
                  <input
                    type="text"
                    value={newWsTitle}
                    onChange={(e) => setNewWsTitle(e.target.value)}
                    placeholder="Nome do Workspace"
                    autoFocus
                    className="w-full text-xs p-1.5 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex space-x-1">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-primary-foreground text-[10px] py-1 rounded font-medium"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingWs(false)}
                      className="flex-1 bg-muted text-muted-foreground text-[10px] py-1 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingWs(true)}
                  className="w-full flex items-center justify-center space-x-1 text-xs text-primary hover:bg-primary/10 p-1.5 rounded transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Workspace</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Indexing Global Banner */}
      {isIndexing && (
        <div
          role="status"
          aria-live="polite"
          className="p-2.5 bg-amber-950/40 border-b border-amber-900/60 text-amber-300 text-xs flex flex-col space-y-1.5"
        >
          <div className="flex items-center space-x-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
            <span className="font-semibold text-[11px]">Reconstruindo índice local...</span>
          </div>
          <div className="w-full bg-amber-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(15, indexingProgress)}%` }}
            />
          </div>
          <span className="text-[10px] text-amber-400/80">
            Ações e envio de chat bloqueados temporariamente.
          </span>
        </div>
      )}

      {/* Specifications list */}
      <div className="p-3 border-b border-border flex-1 overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Specs Importadas ({specifications.length})
          </span>
          <label
            title="Importar OpenAPI (.yaml, .json)"
            className={`text-xs text-primary hover:text-primary/80 flex items-center space-x-1 cursor-pointer focus-within:ring-2 focus-within:ring-primary rounded p-1 ${
              isIndexing ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileChange}
              disabled={isIndexing}
              className="sr-only"
            />
          </label>
        </div>

        {uploadError && (
          <div
            role="alert"
            className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start space-x-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="text-[11px] leading-tight">{uploadError}</span>
          </div>
        )}

        {specifications.length === 0 ? (
          <div className="p-4 rounded border border-dashed border-border/80 text-center space-y-2">
            <FileCode className="w-8 h-8 text-muted-foreground/60 mx-auto" />
            <p className="text-xs text-muted-foreground">
              Nenhuma especificação OpenAPI importada neste workspace.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Faça upload de um arquivo <span className="font-mono">.yaml</span> ou <span className="font-mono">.json</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {specifications.map((spec) => {
              const isSelected = spec.id === activeSpecId;
              const status = spec.jobStatus || 'completed';

              return (
                <div
                  key={spec.id}
                  onClick={() => {
                    if (!isIndexing) {
                      setActiveSpecId(spec.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isIndexing) {
                      setActiveSpecId(spec.id);
                    }
                  }}
                  className={`p-2.5 rounded-md border transition text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
                    isSelected
                      ? 'bg-accent/80 border-primary shadow-sm'
                      : 'bg-accent/20 border-border hover:border-primary/50'
                  } ${isIndexing ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground flex items-center space-x-1.5 truncate">
                      <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-sky-400'}`} />
                      <span className="truncate">{spec.title}</span>
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground font-mono shrink-0">
                      {spec.version}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>{spec.operationCount} operações</span>

                    {/* Status Badge */}
                    <div className="flex items-center space-x-1">
                      {status === 'processing' && (
                        <span className="flex items-center space-x-1 text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px]">Indexando...</span>
                        </span>
                      )}
                      {status === 'completed' && (
                        <span className="flex items-center space-x-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px]">Pronto</span>
                        </span>
                      )}
                      {status === 'failed' && (
                        <span className="flex items-center space-x-1 text-destructive">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[10px]">Falhou</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="pt-3 border-t border-border space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Filtro de Método</span>
          </span>

          {/* Method Filter */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtro de método HTTP">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFilterMethod(m)}
                aria-pressed={filterMethod === m}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition focus:outline-none focus:ring-1 focus:ring-primary ${
                  filterMethod === m
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border bg-card/60 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>SpecLens v0.1.0</span>
        <span className="flex items-center space-x-1 text-emerald-400 font-mono text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Private</span>
        </span>
      </div>
    </aside>
  );
}
