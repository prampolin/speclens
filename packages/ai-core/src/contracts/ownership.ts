import type { Database } from 'better-sqlite3';
import {
  SpecificationRepository,
  IngestionJobRepository,
  OperationRepository,
  VectorNamespaceRepository,
  type RagReasonCode,
} from '@speclens/db';

export type OwnershipBoundary = 'specification' | 'job' | 'operation' | 'namespace';

export class WorkspaceOwnershipError extends Error {
  public readonly code: RagReasonCode;
  public readonly boundary: OwnershipBoundary;
  public readonly expectedWorkspaceId: string;
  public readonly resourceId: string;

  constructor(params: {
    boundary: OwnershipBoundary;
    expectedWorkspaceId: string;
    resourceId: string;
    message: string;
    code?: RagReasonCode;
  }) {
    const code = params.code ?? 'WORKSPACE_OWNERSHIP_MISMATCH';
    super(`[${code}:${params.boundary}] ${params.message}`);
    this.name = 'WorkspaceOwnershipError';
    this.code = code;
    this.boundary = params.boundary;
    this.expectedWorkspaceId = params.expectedWorkspaceId;
    this.resourceId = params.resourceId;
    Object.setPrototypeOf(this, WorkspaceOwnershipError.prototype);
  }
}

export interface SpecificationOwnershipProof {
  readonly verified: true;
  readonly boundary: 'specification';
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly isActive: boolean;
}

export interface JobOwnershipProof {
  readonly verified: true;
  readonly boundary: 'job';
  readonly workspaceId: string;
  readonly jobId: string;
  readonly specificationId: string | null;
}

export interface OperationOwnershipProof {
  readonly verified: true;
  readonly boundary: 'operation';
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly operationId: string;
  readonly isActiveSpec: boolean;
}

export interface NamespaceOwnershipProof {
  readonly verified: true;
  readonly boundary: 'namespace';
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly namespaceId: string;
  readonly isActiveSpec: boolean;
}

export function assertSpecificationOwnership(
  spec:
    | {
        id: string;
        workspaceId: string;
        isActive?: boolean;
      }
    | null
    | undefined,
  expectedWorkspaceId: string,
  options?: { requireActive?: boolean; requestedId?: string }
): SpecificationOwnershipProof {
  const resourceId = spec?.id ?? options?.requestedId ?? 'unknown';
  if (!expectedWorkspaceId || expectedWorkspaceId.trim().length === 0) {
    throw new WorkspaceOwnershipError({
      boundary: 'specification',
      expectedWorkspaceId: '',
      resourceId,
      message: 'expectedWorkspaceId must be non-empty.',
    });
  }

  if (!spec) {
    throw new WorkspaceOwnershipError({
      boundary: 'specification',
      expectedWorkspaceId,
      resourceId,
      message: `Specification "${resourceId}" does not exist or has no persisted record.`,
    });
  }

  if (spec.workspaceId !== expectedWorkspaceId) {
    throw new WorkspaceOwnershipError({
      boundary: 'specification',
      expectedWorkspaceId,
      resourceId: spec.id,
      message: `Specification "${spec.id}" belongs to workspace "${spec.workspaceId}", not "${expectedWorkspaceId}".`,
    });
  }

  const isActive = Boolean(spec.isActive);
  if (options?.requireActive && !isActive) {
    throw new WorkspaceOwnershipError({
      boundary: 'specification',
      expectedWorkspaceId,
      resourceId: spec.id,
      code: 'SPECIFICATION_INACTIVE',
      message: `Specification "${spec.id}" in workspace "${expectedWorkspaceId}" is not the active specification version.`,
    });
  }

  return {
    verified: true,
    boundary: 'specification',
    workspaceId: expectedWorkspaceId,
    specificationId: spec.id,
    isActive,
  };
}

export function assertJobOwnership(
  job:
    | {
        id: string;
        workspaceId: string;
        specificationId?: string | null;
      }
    | null
    | undefined,
  spec:
    | {
        id: string;
        workspaceId: string;
      }
    | null
    | undefined,
  expectedWorkspaceId: string,
  options?: { requestedJobId?: string }
): JobOwnershipProof {
  const resourceId = job?.id ?? options?.requestedJobId ?? 'unknown';
  if (!job) {
    throw new WorkspaceOwnershipError({
      boundary: 'job',
      expectedWorkspaceId,
      resourceId,
      message: `Job "${resourceId}" does not exist.`,
    });
  }

  if (job.workspaceId !== expectedWorkspaceId) {
    throw new WorkspaceOwnershipError({
      boundary: 'job',
      expectedWorkspaceId,
      resourceId: job.id,
      message: `Job "${job.id}" belongs to workspace "${job.workspaceId}", not "${expectedWorkspaceId}".`,
    });
  }

  const specId =
    job.specificationId && job.specificationId.trim().length > 0
      ? job.specificationId
      : null;

  if (specId) {
    if (!spec || spec.id !== specId || spec.workspaceId !== expectedWorkspaceId) {
      throw new WorkspaceOwnershipError({
        boundary: 'job',
        expectedWorkspaceId,
        resourceId: job.id,
        message: `Job "${job.id}" references specification "${specId}" which is not owned by workspace "${expectedWorkspaceId}".`,
      });
    }
  }

  return {
    verified: true,
    boundary: 'job',
    workspaceId: expectedWorkspaceId,
    jobId: job.id,
    specificationId: specId,
  };
}

/**
 * Verifies operation ownership against its parent specification record.
 * Never trusts an operation ID prefix (such as "{specId}:{method}:{path}") alone.
 */
export function assertOperationOwnership(
  operation:
    | {
        id: string;
        specificationId: string;
      }
    | null
    | undefined,
  spec:
    | {
        id: string;
        workspaceId: string;
        isActive?: boolean;
      }
    | null
    | undefined,
  expectedWorkspaceId: string,
  options?: { requireActiveSpec?: boolean; requestedOperationId?: string }
): OperationOwnershipProof {
  const resourceId = operation?.id ?? options?.requestedOperationId ?? 'unknown';
  if (!operation) {
    throw new WorkspaceOwnershipError({
      boundary: 'operation',
      expectedWorkspaceId,
      resourceId,
      message: `Operation "${resourceId}" does not exist.`,
    });
  }

  const specProof = assertSpecificationOwnership(spec, expectedWorkspaceId, {
    requireActive: options?.requireActiveSpec,
    requestedId: operation.specificationId,
  });

  if (operation.specificationId !== specProof.specificationId) {
    throw new WorkspaceOwnershipError({
      boundary: 'operation',
      expectedWorkspaceId,
      resourceId: operation.id,
      message: `Operation "${operation.id}" belongs to specification "${operation.specificationId}", not verified specification "${specProof.specificationId}".`,
    });
  }

  return {
    verified: true,
    boundary: 'operation',
    workspaceId: expectedWorkspaceId,
    specificationId: specProof.specificationId,
    operationId: operation.id,
    isActiveSpec: specProof.isActive,
  };
}

/**
 * Verifies vector namespace / generation ownership against both workspace and specification records.
 * Never trusts a namespaceId hash string alone.
 */
export function assertNamespaceOwnership(
  namespace:
    | {
        id: string;
        workspaceId: string;
        specificationId: string;
      }
    | null
    | undefined,
  spec:
    | {
        id: string;
        workspaceId: string;
        isActive?: boolean;
      }
    | null
    | undefined,
  expectedWorkspaceId: string,
  options?: { requireActiveSpec?: boolean; requestedNamespaceId?: string }
): NamespaceOwnershipProof {
  const resourceId = namespace?.id ?? options?.requestedNamespaceId ?? 'unknown';
  if (!namespace) {
    throw new WorkspaceOwnershipError({
      boundary: 'namespace',
      expectedWorkspaceId,
      resourceId,
      message: `Vector namespace "${resourceId}" does not exist in persisted metadata.`,
    });
  }

  if (namespace.workspaceId !== expectedWorkspaceId) {
    throw new WorkspaceOwnershipError({
      boundary: 'namespace',
      expectedWorkspaceId,
      resourceId: namespace.id,
      message: `Vector namespace "${namespace.id}" belongs to workspace "${namespace.workspaceId}", not "${expectedWorkspaceId}".`,
    });
  }

  const specProof = assertSpecificationOwnership(spec, expectedWorkspaceId, {
    requireActive: options?.requireActiveSpec,
    requestedId: namespace.specificationId,
  });

  if (namespace.specificationId !== specProof.specificationId) {
    throw new WorkspaceOwnershipError({
      boundary: 'namespace',
      expectedWorkspaceId,
      resourceId: namespace.id,
      message: `Vector namespace "${namespace.id}" references specification "${namespace.specificationId}", which does not match verified specification "${specProof.specificationId}".`,
    });
  }

  return {
    verified: true,
    boundary: 'namespace',
    workspaceId: expectedWorkspaceId,
    specificationId: specProof.specificationId,
    namespaceId: namespace.id,
    isActiveSpec: specProof.isActive,
  };
}

export function verifyDatabaseSpecificationOwnership(
  db: Database,
  specificationId: string,
  expectedWorkspaceId: string,
  options?: { requireActive?: boolean }
): SpecificationOwnershipProof {
  const specRepo = new SpecificationRepository(db);
  const spec = specRepo.findById(specificationId);
  return assertSpecificationOwnership(spec, expectedWorkspaceId, {
    requireActive: options?.requireActive,
    requestedId: specificationId,
  });
}

export function verifyDatabaseJobOwnership(
  db: Database,
  jobId: string,
  expectedWorkspaceId: string
): JobOwnershipProof {
  const jobRepo = new IngestionJobRepository(db);
  const specRepo = new SpecificationRepository(db);
  const job = jobRepo.findById(jobId);
  const spec =
    job?.specificationId && job.specificationId.length > 0
      ? specRepo.findById(job.specificationId)
      : null;
  return assertJobOwnership(job, spec, expectedWorkspaceId, {
    requestedJobId: jobId,
  });
}

export function verifyDatabaseOperationOwnership(
  db: Database,
  operationId: string,
  expectedWorkspaceId: string,
  options?: { requireActiveSpec?: boolean }
): OperationOwnershipProof {
  const opRepo = new OperationRepository(db);
  const specRepo = new SpecificationRepository(db);
  const op = opRepo.findById(operationId);
  const spec = op ? specRepo.findById(op.specificationId) : null;
  return assertOperationOwnership(op, spec, expectedWorkspaceId, {
    requireActiveSpec: options?.requireActiveSpec,
    requestedOperationId: operationId,
  });
}

export function verifyDatabaseNamespaceOwnership(
  db: Database,
  namespaceId: string,
  expectedWorkspaceId: string,
  options?: { requireActiveSpec?: boolean }
): NamespaceOwnershipProof {
  const nsRepo = new VectorNamespaceRepository(db);
  const specRepo = new SpecificationRepository(db);
  const ns = nsRepo.findById(namespaceId);
  const spec = ns ? specRepo.findById(ns.specificationId) : null;
  return assertNamespaceOwnership(ns, spec, expectedWorkspaceId, {
    requireActiveSpec: options?.requireActiveSpec,
    requestedNamespaceId: namespaceId,
  });
}
