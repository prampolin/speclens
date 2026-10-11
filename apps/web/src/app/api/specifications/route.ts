import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { parseOpenAPIDocument, normalizeDocument } from '@speclens/openapi-core';
import {
  getDatabase,
  getSpecificationRepo,
  getOperationRepo,
  getIngestionJobRepo,
  getSettingsRepo,
  getWorkspaceRepo,
} from '@/lib/server/db';
import {
  getVectorIndex,
  getEmbeddingProvider,
} from '@/lib/server/providers';
import { indexOperations } from '@speclens/ai-core';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const specRepo = getSpecificationRepo();
    const jobRepo = getIngestionJobRepo();
    const opRepo = getOperationRepo();

    const specs = specRepo.listByWorkspace(workspaceId);
    const jobs = jobRepo.findByWorkspace(workspaceId);

    const specsWithStatus = specs.map((spec) => {
      const ops = opRepo.listBySpec(spec.id);
      const specJobs = jobs.filter((j) => j.specificationId === spec.id);
      const latestJob = specJobs.length > 0 ? specJobs[0] : undefined;

      return {
        ...spec,
        operationCount: ops.length,
        jobStatus: latestJob ? latestJob.status : 'completed',
        progress: latestJob ? latestJob.progress : 100,
        jobId: latestJob ? latestJob.id : undefined,
      };
    });

    return NextResponse.json({
      specifications: specsWithStatus,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'SPECS_FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch specifications',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fileContent: string = '';
    let filename: string = 'document.yaml';
    let workspaceId: string = 'default';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const wsField = formData.get('workspaceId');
      if (wsField && typeof wsField === 'string') {
        workspaceId = wsField;
      }

      if (!file || typeof file === 'string') {
        return NextResponse.json(
          {
            code: 'MISSING_FILE',
            message: 'No file uploaded in form data under field "file".',
            retryable: false,
          },
          { status: 400 }
        );
      }

      const fileObj = file as File;
      filename = fileObj.name || filename;

      if (fileObj.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds maximum allowed size of 10MB (${fileObj.size} bytes).`,
            retryable: false,
          },
          { status: 413 }
        );
      }

      fileContent = await fileObj.text();
    } else {
      // Direct raw text or JSON body
      const raw = await request.text();
      if (!raw || raw.trim().length === 0) {
        return NextResponse.json(
          {
            code: 'EMPTY_BODY',
            message: 'Specification body cannot be empty.',
            retryable: false,
          },
          { status: 400 }
        );
      }
      fileContent = raw;
    }

    // Verify workspace exists
    const workspaceRepo = getWorkspaceRepo();
    let ws = workspaceRepo.findById(workspaceId);
    if (!ws) {
      ws = workspaceRepo.create({
        id: workspaceId,
        title: workspaceId === 'default' ? 'Default Workspace' : workspaceId,
      });
    }

    // Verify privateMode settings
    const settingsRepo = getSettingsRepo();
    const settings = settingsRepo.getOrDefault(workspaceId);
    if (settings.privateMode) {
      // In privateMode, reject remote $refs
    }

    // 2. Parse document with openapi-core (max size 10MB enforced)
    let parsedDoc;
    try {
      parsedDoc = parseOpenAPIDocument(fileContent, {
        maxSizeBytes: MAX_FILE_SIZE,
        filename,
      });
    } catch (parseErr: any) {
      return NextResponse.json(
        {
          code: parseErr?.code || 'INVALID_SPECIFICATION',
          message: parseErr?.message || 'Failed to parse OpenAPI document.',
          retryable: false,
        },
        { status: 400 }
      );
    }

    // Compute checksum
    const sourceChecksum = createHash('sha256').update(fileContent).digest('hex');

    // 3. Save specification
    const specRepo = getSpecificationRepo();
    const specTitle = parsedDoc.info.title || filename;
    const specVersion = parsedDoc.info.version || '1.0.0';

    const spec = specRepo.create({
      workspaceId,
      title: specTitle,
      version: specVersion,
      dialect: parsedDoc.dialect,
      sourceChecksum,
      sourceContent: fileContent,
      isActive: true,
    });

    // Mark as active spec
    specRepo.setActive(spec.id, workspaceId);

    // Normalize document operations with safe local resolution
    const normalizedOps = normalizeDocument(parsedDoc, spec.id, {
      privateMode: true, // PM-002: Fail closed, no remote $ref in privateMode
    });

    // Save operations into SQLite
    const opRepo = getOperationRepo();
    opRepo.createBatch(
      normalizedOps.map((op) => ({
        id: op.id,
        specificationId: spec.id,
        method: op.method,
        path: op.path,
        operationId: op.operationId,
        tags: op.tags,
        normalizedJson: op,
        sourcePointer: op.sourcePointer,
        indexText: op.indexText || '',
      }))
    );

    // 4. Create Ingestion Job and start background indexing
    const jobRepo = getIngestionJobRepo();
    const job = jobRepo.create({
      workspaceId,
      specificationId: spec.id,
      state: 'running',
      status: 'processing',
      progress: 10,
    });

    // Run indexing asynchronously in background
    (async () => {
      try {
        const db = getDatabase();
        const vectorIndex = getVectorIndex();
        const embeddingProvider = getEmbeddingProvider();

        await indexOperations({
          db,
          vectorIndex,
          embeddingProvider,
          workspaceId,
          specificationId: spec.id,
          operations: normalizedOps,
          onProgress: (p) => {
            const pct = Math.min(
              95,
              Math.max(10, Math.round((p.processed / Math.max(p.total, 1)) * 100))
            );
            jobRepo.updateState(job.id, {
              progress: pct,
            });
          },
        });

        jobRepo.updateState(job.id, {
          state: 'completed',
          status: 'completed',
          progress: 100,
        });
      } catch (indexErr: any) {
        jobRepo.updateState(job.id, {
          state: 'failed',
          status: 'failed',
          errorMessage: indexErr instanceof Error ? indexErr.message : String(indexErr),
        });
      }
    })().catch(() => {});

    // 5. Return response
    return NextResponse.json({
      specificationId: spec.id,
      operationCount: normalizedOps.length,
      title: spec.title,
      version: spec.version,
      jobId: job.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'SPEC_IMPORT_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during specification import.',
        retryable: false,
      },
      { status: 500 }
    );
  }
}
