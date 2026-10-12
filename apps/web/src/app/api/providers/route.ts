import { NextRequest, NextResponse } from 'next/server';
import { getProvidersReadiness } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId') ?? 'default';
    const readiness = await getProvidersReadiness(workspaceId);

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
