import { codeToHtml } from 'shiki';

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
    return await codeToHtml(code, {
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
