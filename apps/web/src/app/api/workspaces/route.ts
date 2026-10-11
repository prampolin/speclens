import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRepo, getSettingsRepo } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaceRepo = getWorkspaceRepo();
    const workspaces = workspaceRepo.list();

    return NextResponse.json({
      workspaces,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'WORKSPACES_LIST_ERROR',
        message: err instanceof Error ? err.message : 'Failed to list workspaces',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New Workspace';
    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined;

    const workspaceRepo = getWorkspaceRepo();
    const ws = workspaceRepo.create({
      id,
      title,
    });

    // Initialize default settings for workspace
    const settingsRepo = getSettingsRepo();
    settingsRepo.getOrDefault(ws.id);

    return NextResponse.json({
      workspace: ws,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'WORKSPACE_CREATE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to create workspace',
      },
      { status: 500 }
    );
  }
}
