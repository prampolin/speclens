import {
  ClassifyResult,
  DecisionProvider,
  Intent,
  ProviderManifest,
  ReadinessResult,
} from '../types.js';

export class RuleDecisionProvider implements DecisionProvider {
  public readonly manifest: ProviderManifest = {
    id: 'rule-based',
    kind: 'decision',
    implementationVersion: '1.0.0',
    executionLocation: 'local',
    requiresNetwork: false,
    modelId: 'rule-patterns-v1',
    modelRevision: '1.0',
    supportsOffline: true,
  };

  private static readonly COMPARE_REGEX =
    /(?:^|\s|\b)(comparar|compare|compara[çc][ãa]o|diferen[çc]a|difference|versus|vs|difere)(?:$|\s|\b|[?.!,])/iu;

  private static readonly GENERATE_REGEX =
    /(?:^|\s|\b)(gerar|gerador|gere|generate|c[óo]digo|code|curl|fetch|python|snippet|exemplo|example|payload|requisitar|request body)(?:$|\s|\b|[?.!,])/iu;

  private static readonly EXPLAIN_REGEX =
    /(?:^|\s|\b)(explicar|explique|explain|o que [ée]|what is|significa|meaning|estrutura|schema|modelo|model|campo|field|detalhes?)(?:$|\s|\b|[?.!,])/iu;

  public async readiness(): Promise<ReadinessResult> {
    return { ready: true };
  }

  public async classify(
    input: string,
    candidates: Intent[] = [
      'search_endpoint',
      'generate_code',
      'explain_schema',
      'compare_endpoints',
    ],
    signal?: AbortSignal
  ): Promise<ClassifyResult> {
    if (signal?.aborted) {
      throw new Error('Classification aborted by signal.');
    }

    const trimmed = input.trim();
    let chosen: Intent;

    if (RuleDecisionProvider.COMPARE_REGEX.test(trimmed)) {
      chosen = 'compare_endpoints';
    } else if (RuleDecisionProvider.GENERATE_REGEX.test(trimmed)) {
      chosen = 'generate_code';
    } else if (RuleDecisionProvider.EXPLAIN_REGEX.test(trimmed)) {
      chosen = 'explain_schema';
    } else {
      chosen = 'search_endpoint';
    }

    // Filter by allowed candidates if restricted
    if (!candidates.includes(chosen)) {
      chosen = candidates.includes('search_endpoint')
        ? 'search_endpoint'
        : (candidates[0] ?? 'search_endpoint');
    }

    return {
      intent: chosen,
      confidence: null, // Deterministic rule-based matching has no calibrated continuous confidence
      abstained: false,
      providerId: this.manifest.id,
    };
  }
}
