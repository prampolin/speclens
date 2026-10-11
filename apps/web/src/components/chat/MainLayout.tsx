'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { EndpointInspector } from './EndpointInspector';
import type { SourceCitation } from '@speclens/ai-core';

export function MainLayout() {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);

  const handleOpenInspector = (citation: SourceCitation) => {
    setSelectedCitation(citation);
    setIsInspectorOpen(true);
  };

  const handleCloseInspector = () => {
    setIsInspectorOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Coluna 1: Sidebar esquerda */}
      <Sidebar />

      {/* Coluna 2: Chat principal */}
      <ChatArea onOpenInspector={handleOpenInspector} isInspectorOpen={isInspectorOpen} />

      {/* Coluna 3: Drawer direita (fechada por padrão) */}
      <EndpointInspector
        isOpen={isInspectorOpen}
        onClose={handleCloseInspector}
        citation={selectedCitation}
      />
    </div>
  );
}
