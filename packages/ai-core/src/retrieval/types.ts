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
  topK?: number;
}

export interface RetrievalResult {
  operationId: string;
  specificationId: string;
  method: string;
  path: string;
  lexicalScore: number | null; // null se lexical não contribuiu
  vectorScore: number | null;  // null se vector não contribuiu
  fusedScore: number;
  rank: number;
  lexicalRank: number | null;
  vectorRank: number | null;
}

export interface FusionConfig {
  algorithm?: 'rrf' | 'weighted';
  k?: number;            // fator RRF (default: 60)
  rrfK?: number;         // alias/compat com scaffold anterior
  lexicalWeight?: number; // peso na fusão (default: 0.5)
  vectorWeight?: number;  // peso na fusão (default: 0.5)
  topK?: number;          // número de resultados
  threshold?: number;     // score mínimo para incluir
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
  specificationId: z.string().min(1),
  method: z.string().min(1),
  path: z.string().min(1),
  lexicalScore: z.number().nullable(),
  vectorScore: z.number().nullable(),
  fusedScore: z.number(),
  rank: z.number().int().positive(),
  lexicalRank: z.number().int().positive().nullable(),
  vectorRank: z.number().int().positive().nullable(),
});

export const fusionConfigSchema = z.object({
  algorithm: z.enum(['rrf', 'weighted']).default('rrf'),
  k: z.number().positive().default(60),
  rrfK: z.number().positive().optional(),
  lexicalWeight: z.number().min(0).max(1).default(0.5),
  vectorWeight: z.number().min(0).max(1).default(0.5),
  topK: z.number().int().positive().default(5),
  threshold: z.number().min(0).optional(),
});
