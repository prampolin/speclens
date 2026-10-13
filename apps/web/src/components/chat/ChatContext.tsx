'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SourceCitation } from '@speclens/ai-core';

export interface WorkspaceItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecItem {
  id: string;
  workspaceId: string;
  title: string;
  version: string;
  dialect: string;
  sourceChecksum: string;
  isActive: boolean;
  operationCount: number;
  jobStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  jobId?: string;
}

export interface SnippetItem {
  language: 'curl' | 'javascript' | 'python' | string;
  label: string;
  code: string;
  validated: boolean;
  validationWarnings?: string[];
  html?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  stage?: 'classifying' | 'retrieving' | 'grounding' | 'explaining' | 'done';
  statusMessage?: string;
  intent?: {
    intent: string;
    confidence: number | null;
    providerId?: string;
  };
  retrievalResults?: Array<{
    operationId: string;
    specificationId: string;
    method: string;
    path: string;
    tags: string[];
    fusedScore: number;
    lexicalScore: number | null;
    vectorScore: number | null;
    rank: number;
  }>;
  sources?: SourceCitation[];
  snippets?: SnippetItem[];
  limitations?: string[];
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
    retryable?: boolean;
  };
}

interface ChatContextType {
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  workspaces: WorkspaceItem[];
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (title: string) => Promise<WorkspaceItem | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;

  specifications: SpecItem[];
  refreshSpecifications: () => Promise<void>;
  uploadSpecification: (file: File) => Promise<{ success: boolean; message?: string }>;
  activeSpecId: string | null;
  setActiveSpecId: (id: string | null) => void;

  isIndexing: boolean;
  indexingProgress: number;

  filterMethod: string;
  setFilterMethod: (method: string) => void;
  filterTag: string;
  setFilterTag: (tag: string) => void;
  filterSearch: string;
  setFilterSearch: (query: string) => void;

  messages: ChatMessage[];
  sendMessage: (query: string) => Promise<void>;
  isStreaming: boolean;
  clearChat: () => void;

  isInspectorOpen: boolean;
  setIsInspectorOpen: (open: boolean) => void;
  selectedCitation: SourceCitation | null;
  openInspector: (citation: SourceCitation, candidates?: any[]) => void;
  closeInspector: () => void;
  inspectorCandidates: any[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string>('default');
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [specifications, setSpecifications] = useState<SpecItem[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);

  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [inspectorCandidates, setInspectorCandidates] = useState<any[]>([]);

  // Fetch workspaces
  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch {
      // Fallback workspace
      setWorkspaces([{ id: 'default', title: 'Default Workspace', createdAt: '', updatedAt: '' }]);
    }
  }, []);

  // Fetch specifications
  const refreshSpecifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/specifications?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        const data = await res.json();
        const specs = data.specifications || [];
        setSpecifications(specs);

        // Find active
        const active = specs.find((s: SpecItem) => s.isActive);
        if (active) {
          setActiveSpecId(active.id);
        } else if (specs.length > 0) {
          setActiveSpecId(specs[0].id);
        }
      }
    } catch {
      setSpecifications([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    refreshSpecifications();
  }, [refreshSpecifications]);

  // Check if any spec is indexing
  const isIndexing = specifications.some((s) => s.jobStatus === 'processing');
  const indexingProgress = specifications.find((s) => s.jobStatus === 'processing')?.progress || 0;

  // Poll while indexing
  useEffect(() => {
    if (!isIndexing) return;
    const timer = setInterval(() => {
      refreshSpecifications();
    }, 2000);
    return () => clearInterval(timer);
  }, [isIndexing, refreshSpecifications]);

  // Create workspace
  const createWorkspace = async (title: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshWorkspaces();
        setWorkspaceId(data.workspace.id);
        return data.workspace;
      }
    } catch {
      return null;
    }
    return null;
  };

  // Delete workspace
  const deleteWorkspace = async (id: string) => {
    if (id === 'default') {
      alert('O workspace padrão não pode ser excluído.');
      return false;
    }
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refreshWorkspaces();
        setWorkspaceId('default');
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  // Upload specification
  const uploadSpecification = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);

      const res = await fetch('/api/specifications', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Falha ao importar OpenAPI' };
      }

      await refreshSpecifications();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro de conexão no upload' };
    }
  };

  // Send Chat message via SSE
  const sendMessage = async (queryText: string) => {
    if (!queryText.trim() || isStreaming || isIndexing) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText.trim(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      stage: 'classifying',
      statusMessage: 'Iniciando processamento da consulta...',
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText.trim(),
          workspaceId,
          specificationId: activeSpecId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  stage: 'done',
                  error: {
                    code: errorData.code || `HTTP_${response.status}`,
                    message: errorData.message || 'Erro ao processar consulta.',
                    recoverable: true,
                    retryable: true,
                  },
                }
              : msg
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao abrir stream de leitura');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr);

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantId) return msg;

                if (event.type === 'status') {
                  return {
                    ...msg,
                    stage: event.stage || msg.stage,
                    statusMessage: event.message,
                  };
                }

                if (event.type === 'intent') {
                  return {
                    ...msg,
                    intent: {
                      intent: event.intent,
                      confidence: event.confidence,
                      providerId: event.providerId,
                    },
                  };
                }

                if (event.type === 'retrieval') {
                  return {
                    ...msg,
                    retrievalResults: event.results,
                  };
                }

                if (event.type === 'sources') {
                  return {
                    ...msg,
                    sources: event.sources,
                  };
                }

                if (event.type === 'snippets') {
                  return {
                    ...msg,
                    snippets: event.snippets,
                  };
                }

                if (event.type === 'token') {
                  const tokenText = event.token || event.content || '';
                  return {
                    ...msg,
                    content: msg.content + tokenText,
                  };
                }

                if (event.type === 'final') {
                  const envelope = event.envelope;
                  return {
                    ...msg,
                    stage: 'done',
                    content: envelope.answer.explanation || msg.content,
                    sources: envelope.sources || msg.sources,
                    snippets: event.snippetsWithHtml || envelope.snippets || msg.snippets,
                    limitations: envelope.answer.limitations || [],
                  };
                }

                if (event.type === 'error') {
                  return {
                    ...msg,
                    error: {
                      code: event.code,
                      message: event.message,
                      recoverable: event.recoverable,
                      retryable: event.retryable,
                    },
                  };
                }

                return msg;
              })
            );
          } catch {
            // Ignore malformed SSE chunk
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                stage: 'done',
                error: {
                  code: 'STREAM_EXCEPTION',
                  message: err.message || 'Conexão interrompida.',
                  recoverable: true,
                  retryable: true,
                },
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantId ? { ...msg, stage: 'done' } : msg))
      );
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const openInspector = (citation: SourceCitation, candidates?: any[]) => {
    setSelectedCitation(citation);
    if (candidates) {
      setInspectorCandidates(candidates);
    }
    setIsInspectorOpen(true);
  };

  const closeInspector = () => {
    setIsInspectorOpen(false);
  };

  return (
    <ChatContext.Provider
      value={{
        workspaceId,
        setWorkspaceId,
        workspaces,
        refreshWorkspaces,
        createWorkspace,
        deleteWorkspace,

        specifications,
        refreshSpecifications,
        uploadSpecification,
        activeSpecId,
        setActiveSpecId,

        isIndexing,
        indexingProgress,

        filterMethod,
        setFilterMethod,
        filterTag,
        setFilterTag,
        filterSearch,
        setFilterSearch,

        messages,
        sendMessage,
        isStreaming,
        clearChat,

        isInspectorOpen,
        setIsInspectorOpen,
        selectedCitation,
        openInspector,
        closeInspector,
        inspectorCandidates,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
