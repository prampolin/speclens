import { NextRequest, NextResponse } from 'next/server';
import { getSettingsRepo, getWorkspaceRepo } from '@/lib/server/db';
import { workspaceSettingsSchema } from '@speclens/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const settingsRepo = getSettingsRepo();
    const settings = settingsRepo.get(workspaceId) ?? settingsRepo.save(
      workspaceId,
      (await import('@/lib/server/providers')).resolveWorkspaceSettings(workspaceId)
    );

    return NextResponse.json({
      settings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'SETTINGS_READ_ERROR',
        message: err instanceof Error ? err.message : 'Failed to load settings',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'default';

    // Verify workspace exists
    const workspaceRepo = getWorkspaceRepo();
    const ws = workspaceRepo.findById(workspaceId);
    if (!ws) {
      return NextResponse.json(
        {
          code: 'WORKSPACE_NOT_FOUND',
          message: `Workspace "${workspaceId}" not found`,
        },
        { status: 404 }
      );
    }

    const settingsRepo = getSettingsRepo();
    const currentSettings = settingsRepo.get(workspaceId) ?? (await import('@/lib/server/providers')).resolveWorkspaceSettings(workspaceId);

    const merged = {
      ...currentSettings,
      ...body.settings,
      workspaceId,
    };

    // Zod validation on write
    const validated = workspaceSettingsSchema.parse(merged);
    if (validated.llm.providerId !== 'ollama-local') {
      return NextResponse.json(
        { code: 'UNSUPPORTED_PROVIDER', message: 'Unsupported LLM provider.' },
        { status: 400 }
      );
    }
    if (validated.privateMode && /^(cloud|remote|openai|anthropic|claude|gemini|azure|bedrock|cohere|mistral-cloud)\//i.test(validated.llm.modelId)) {
      return NextResponse.json(
        { code: 'UNSAFE_PROVIDER_CONFIGURATION', message: 'Cloud-backed models are not allowed in Private Mode.' },
        { status: 400 }
      );
    }

    // Check if embedding configuration changed requiring reindex
    const isEmbeddingChanged =
      currentSettings.embedding.providerId !== validated.embedding.providerId ||
      currentSettings.embedding.modelId !== validated.embedding.modelId ||
      currentSettings.embedding.revision !== validated.embedding.revision;

    const saved = settingsRepo.save(workspaceId, validated);

    return NextResponse.json({
      settings: saved,
      reindexRequired: isEmbeddingChanged,
      message: isEmbeddingChanged
        ? 'Settings saved. Embedding changed, re-indexing of specifications is required.'
        : 'Settings saved successfully.',
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workspace settings format',
          errors: err.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        code: 'SETTINGS_SAVE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to save settings',
      },
      { status: 500 }
    );
  }
}
