import { NextRequest, NextResponse } from 'next/server';
import { highlightSnippet } from '@/lib/server/shiki';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code : '';
    const lang = typeof body.lang === 'string' ? body.lang : 'text';

    const html = await highlightSnippet(code, lang);

    return NextResponse.json({
      html,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'HIGHLIGHT_ERROR',
        message: err instanceof Error ? err.message : 'Failed to highlight code',
      },
      { status: 500 }
    );
  }
}
