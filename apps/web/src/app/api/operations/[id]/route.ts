import { NextRequest, NextResponse } from 'next/server';
import { getOperationRepo, getSpecificationRepo } from '@/lib/server/db';
import type { NormalizedOperation } from '@speclens/openapi-core';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const opRepo = getOperationRepo();
    const operation = opRepo.findById(id);

    if (!operation) {
      return NextResponse.json(
        {
          code: 'OPERATION_NOT_FOUND',
          message: `Operation with ID "${id}" was not found.`,
        },
        { status: 404 }
      );
    }

    // Validate that the operation belongs to the requested workspace
    const specRepo = getSpecificationRepo();
    const spec = specRepo.findById(operation.specificationId);

    if (!spec || spec.workspaceId !== workspaceId) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN_WORKSPACE',
          message: `Operation does not belong to workspace "${workspaceId}".`,
        },
        { status: 403 }
      );
    }

    let parsedNormalized: NormalizedOperation;
    try {
      parsedNormalized = JSON.parse(operation.normalizedJson) as NormalizedOperation;
    } catch {
      parsedNormalized = {
        id: operation.id,
        specId: operation.specificationId,
        method: operation.method as any,
        path: operation.path,
        operationId: operation.operationId,
        tags: operation.tags,
        sourcePointer: operation.sourcePointer,
        servers: [],
        parameters: [],
        responses: {},
      };
    }

    return NextResponse.json({
      operation: parsedNormalized,
      specification: {
        id: spec.id,
        title: spec.title,
        version: spec.version,
        dialect: spec.dialect,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'OPERATION_FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to retrieve operation',
      },
      { status: 500 }
    );
  }
}
