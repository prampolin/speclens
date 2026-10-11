import { NextResponse } from 'next/server';
import { getProvidersReadiness } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const readiness = await getProvidersReadiness();

    return NextResponse.json({
      providers: readiness.providers,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'PROVIDERS_ERROR',
        message: err instanceof Error ? err.message : 'Failed to query providers',
      },
      { status: 500 }
    );
  }
}
