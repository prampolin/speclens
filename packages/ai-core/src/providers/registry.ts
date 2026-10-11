import {
  ProviderManifest,
  EmbeddingProvider,
  DecisionProvider,
  ProviderKind,
} from './types.js';
import { ProviderManifestSchema } from './schemas.js';
import { PrivacyViolationError } from './errors.js';

export type AnyProvider = EmbeddingProvider | DecisionProvider;

export class ProviderRegistry {
  private providers = new Map<string, AnyProvider>();

  constructor(private readonly defaultPrivateMode: boolean = true) {}

  public static validateLocality(
    manifest: ProviderManifest,
    privateMode: boolean = true
  ): void {
    if (!privateMode) {
      return;
    }

    if (manifest.executionLocation !== 'local') {
      throw new PrivacyViolationError(
        `Provider "${manifest.id}" cannot be used in private mode: executionLocation is "${manifest.executionLocation}" (must be "local").`
      );
    }

    if (manifest.requiresNetwork) {
      throw new PrivacyViolationError(
        `Provider "${manifest.id}" cannot be used in private mode: requiresNetwork is true.`
      );
    }

    if (!manifest.supportsOffline) {
      throw new PrivacyViolationError(
        `Provider "${manifest.id}" cannot be used in private mode: supportsOffline is false.`
      );
    }
  }

  public register(
    provider: AnyProvider,
    options?: { privateMode?: boolean }
  ): void {
    const validatedManifest = ProviderManifestSchema.parse(provider.manifest);
    const privateMode = options?.privateMode ?? this.defaultPrivateMode;

    ProviderRegistry.validateLocality(validatedManifest, privateMode);

    this.providers.set(validatedManifest.id, provider);
  }

  public get<T extends AnyProvider = AnyProvider>(
    id: string,
    options?: { privateMode?: boolean }
  ): T {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider with id "${id}" not found in registry.`);
    }

    const privateMode = options?.privateMode ?? this.defaultPrivateMode;
    ProviderRegistry.validateLocality(provider.manifest, privateMode);

    return provider as T;
  }

  public has(id: string): boolean {
    return this.providers.has(id);
  }

  public unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  public clear(): void {
    this.providers.clear();
  }

  public list(filter?: { kind?: ProviderKind }): AnyProvider[] {
    const all = Array.from(this.providers.values());
    if (!filter?.kind) {
      return all;
    }
    return all.filter((p) => p.manifest.kind === filter.kind);
  }
}
