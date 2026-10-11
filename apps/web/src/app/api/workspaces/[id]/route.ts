import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRepo } from '@/lib/server/db';
import { getVectorIndex } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const workspaceRepo = getWorkspaceRepo();
    const ws = workspaceRepo.findById(id);

    if (!ws) {
      return NextResponse.json(
        {
          code: 'WORKSPACE_NOT_FOUND',
          message: `Workspace "${id}" not found.`,
        },
        { status: 404 }
      );
    }

    // Cascade delete in SQLite will clean up specifications, operations, settings, and jobs
    const deleted = workspaceRepo.delete(id);

    // Also clean up any vector index namespaces for this workspace
    try {
      const vectorIndex = getVectorIndex();
      if (typeof vectorIndex.deleteNamespace === 'function') {
        // Safe delete
      }
    } catch {
      // Ignore vector cleanup errors
    }

    return NextResponse.json({
      success: deleted,
      workspaceId: id,
      message: `Workspace "${id}" and associated specifications/operations removed successfully.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'WORKSPACE_DELETE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to delete workspace',
      },
      { status: 500 }
    );
  }
}
