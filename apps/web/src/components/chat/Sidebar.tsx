'use client';

import { useState } from 'react';
import { Layers, FileCode, Search, Filter, Plus, ChevronDown } from 'lucide-react';

interface SidebarProps {
  onSelectOperation?: (operationId: string) => void;
}

export function Sidebar({ onSelectOperation: _onSelectOperation }: SidebarProps) {
  const [selectedWorkspace] = useState('Default Workspace');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterPath, setFilterPath] = useState<string>('');

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Initial mockup operations without making external calls
  const dummySpecs = [
    {
      id: 'spec-1',
      title: 'Store Catalog API',
      version: 'v1.4.0',
      dialect: 'OpenAPI 3.1',
      operationsCount: 12,
    },
  ];

  return (
    <aside className="w-72 border-r border-border bg-card/40 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Workspace Selector */}
      <div className="p-3 border-b border-border">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Workspace
        </label>
        <div className="flex items-center justify-between p-2 rounded bg-accent/40 border border-border text-sm cursor-pointer hover:bg-accent/60 transition">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="font-medium truncate">{selectedWorkspace}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Specifications list */}
      <div className="p-3 border-b border-border flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Specs Importadas
          </span>
          <button
            title="Importar OpenAPI"
            className="text-xs text-primary hover:text-primary/80 flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
        </div>

        <div className="space-y-1.5">
          {dummySpecs.map((spec) => (
            <div
              key={spec.id}
              className="p-2.5 rounded-md bg-accent/30 border border-border/80 hover:border-primary/50 cursor-pointer transition text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground flex items-center space-x-1.5 truncate">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>{spec.title}</span>
                </span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                  {spec.version}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{spec.dialect}</span>
                <span>{spec.operationsCount} ops</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-4 pt-3 border-t border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Filtros</span>
          </span>

          {/* Method Filter */}
          <div className="flex flex-wrap gap-1 my-2">
            {methods.map((m) => (
              <button
                key={m}
                onClick={() => setFilterMethod(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition ${
                  filterMethod === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Path Search */}
          <div className="relative mt-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={filterPath}
              onChange={(e) => setFilterPath(e.target.value)}
              placeholder="Filtrar path (ex: /items)..."
              className="w-full bg-background/80 border border-border rounded-md pl-8 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
        <span>SQLite + FTS5 Ready</span>
      </div>
    </aside>
  );
}
