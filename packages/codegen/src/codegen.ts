import type { NormalizedOperation } from '@speclens/openapi-core';
import type { CodeSnippet } from '@speclens/ai-core';
import type {
  CodegenRequest,
  CodegenResult,
  CodegenOptions,
  CodeGenerator,
  SupportedLanguage,
} from './types.js';
import { buildRequestModel } from './builders/request-builder.js';
import { generateCurl } from './builders/curl.js';
import { generateFetch } from './builders/fetch.js';
import { generatePython } from './builders/python.js';
import { validateSnippet } from './validator.js';

export function getLanguageLabel(lang: SupportedLanguage): string {
  switch (lang) {
    case 'curl':
      return 'cURL';
    case 'javascript':
      return 'fetch';
    case 'python':
      return 'Python (requests)';
  }
}

export function generateSnippets(req: CodegenRequest): CodegenResult {
  const requestModel = buildRequestModel(req.operation, {
    groundedValues: req.groundedValues,
    baseUrl: req.baseUrl,
  });

  const validation = validateSnippet(requestModel, req.operation);

  const snippets: CodeSnippet[] = req.languages.map((language) => {
    let code = '';
    const label = getLanguageLabel(language);

    switch (language) {
      case 'curl':
        code = generateCurl(requestModel, { baseUrl: req.baseUrl });
        break;
      case 'javascript':
        code = generateFetch(requestModel, { baseUrl: req.baseUrl });
        break;
      case 'python':
        code = generatePython(requestModel, { baseUrl: req.baseUrl });
        break;
    }

    return {
      language,
      label,
      code,
      validated: validation.valid,
      validationWarnings: validation.warnings,
    };
  });

  return {
    snippets,
    requestModel,
  };
}

export class DeterministicCodeGenerator implements CodeGenerator {
  async generate(operation: NormalizedOperation, options: CodegenOptions): Promise<CodeSnippet> {
    const result = generateSnippets({
      operation,
      languages: [options.language],
      groundedValues: options.groundedValues,
      baseUrl: options.baseUrl ?? options.serverUrl,
    });

    const snippet = result.snippets[0];
    if (!snippet) {
      throw new Error(`Failed to generate code snippet for language: ${options.language}`);
    }

    return snippet;
  }
}
