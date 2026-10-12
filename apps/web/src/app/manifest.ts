import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SpecLens — Local-First API Assistant',
    short_name: 'SpecLens',
    description: 'Assistente inteligente e privado para contratos OpenAPI e Swagger',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b0f17',
    theme_color: '#0b0f17',
    categories: ['developer', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
