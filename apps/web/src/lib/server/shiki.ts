let codeToHtmlFn: ((code: string, options: any) => Promise<string>) | null = null;

export async function highlightSnippet(
  code: string,
  lang: 'curl' | 'javascript' | 'python' | string
): Promise<string> {
  const languageMap: Record<string, string> = {
    curl: 'bash',
    javascript: 'javascript',
    python: 'python',
    json: 'json',
  };

  const resolvedLang = languageMap[lang.toLowerCase()] ?? 'text';

  try {
    if (!codeToHtmlFn) {
      const mod = await import('shiki');
      codeToHtmlFn = mod.codeToHtml;
    }
    return await codeToHtmlFn(code, {
      lang: resolvedLang,
      theme: 'github-dark-default',
    });
  } catch {
    // Escape HTML as fallback
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code class="language-${resolvedLang}">${escaped}</code></pre>`;
  }
}
