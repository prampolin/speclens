import { NextRequest, NextResponse } from 'next/server';
import { getIngestionJobRepo } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobRepo = getIngestionJobRepo();
    const job = jobRepo.findById(id);

    if (!job) {
      return NextResponse.json(
        {
          code: 'JOB_NOT_FOUND',
          message: `Ingestion job "${id}" was not found.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      job,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'JOB_FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to retrieve job status',
      },
      { status: 500 }
    );
  }
}
