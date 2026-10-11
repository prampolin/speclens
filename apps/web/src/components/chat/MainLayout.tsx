'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { EndpointInspector } from './EndpointInspector';
import { ChatProvider } from './ChatContext';

export function MainLayout() {
  return (
    <ChatProvider>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Coluna 1: Sidebar esquerda */}
        <Sidebar />

        {/* Coluna 2: Chat principal */}
        <ChatArea />

        {/* Coluna 3: Drawer direita (Endpoint & RAG Inspector) */}
        <EndpointInspector />
      </div>
    </ChatProvider>
  );
}
