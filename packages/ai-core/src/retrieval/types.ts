import { z } from 'zod';

export interface HybridQueryFilters {
  methods?: string[];
  tags?: string[];
  paths?: string[];
}

export interface HybridQuery {
  text: string;
  workspaceId: string;
  specificationId?: string;
  filters?: HybridQueryFilters;
  topK: number;
}

export interface RetrievalResult {
  operationId: string;
  lexicalScore: number | null;
  vectorScore: number | null;
  fusedScore: number;
  rank: number;
}

export interface FusionConfig {
  algorithm: 'rrf' | 'weighted';
  rrfK?: number;
  lexicalWeight?: number;
  vectorWeight?: number;
}

export interface HybridRetrieval {
  search(query: HybridQuery): Promise<RetrievalResult[]>;
}

export const hybridQueryFiltersSchema = z.object({
  methods: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
});

export const hybridQuerySchema = z.object({
  text: z.string().min(1),
  workspaceId: z.string().min(1),
  specificationId: z.string().optional(),
  filters: hybridQueryFiltersSchema.optional(),
  topK: z.number().int().positive().default(5),
});

export const retrievalResultSchema = z.object({
  operationId: z.string().min(1),
  lexicalScore: z.number().nullable(),
  vectorScore: z.number().nullable(),
  fusedScore: z.number(),
  rank: z.number().int().positive(),
});

export const fusionConfigSchema = z.object({
  algorithm: z.enum(['rrf', 'weighted']),
  rrfK: z.number().positive().optional(),
  lexicalWeight: z.number().min(0).max(1).optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
});
