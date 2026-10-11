import { NextResponse } from 'next/server';
import { getProvidersReadiness } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const readiness = await getProvidersReadiness();
    const isDegraded = !readiness.db.ready || readiness.providers.some((p) => !p.ready);

    return NextResponse.json({
      status: isDegraded ? 'degraded' : 'ok',
      db: readiness.db.ready,
      dbReason: readiness.db.reason,
      providers: readiness.providers.map((p) => ({
        id: p.id,
        kind: p.kind,
        executionLocation: p.executionLocation,
        ready: p.ready,
        reason: p.reason,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown health check error',
      },
      { status: 500 }
    );
  }
}
