import type { NextConfig } from 'next';

process.env.NEXT_TELEMETRY_DISABLED = '1';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@speclens/ai-core',
    '@speclens/openapi-core',
    '@speclens/db',
    '@speclens/codegen',
    '@speclens/evals',
  ],
  images: {
    // Strictly block external image domains for privacy
    remotePatterns: [],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "connect-src 'self' http://127.0.0.1:* http://localhost:*",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
