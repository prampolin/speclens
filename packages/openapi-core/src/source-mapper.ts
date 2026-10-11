/**
 * RFC 6901 JSON Pointer escaping and source mapping
 */

export function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function buildJsonPointer(segments: string[]): string {
  if (segments.length === 0) return '#';
  return '#' + segments.map((s) => '/' + encodePointerSegment(s)).join('');
}

export function getOperationSourcePointer(path: string, method: string): string {
  return buildJsonPointer(['paths', path, method.toLowerCase()]);
}

export function getValueAtPointer(root: unknown, pointer: string): unknown {
  if (!pointer || pointer === '#' || pointer === '') return root;
  const cleanPointer = pointer.startsWith('#/') ? pointer.slice(2) : pointer.startsWith('/') ? pointer.slice(1) : pointer;
  const segments = cleanPointer.split('/').map(decodePointerSegment);

  let current: any = root;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
