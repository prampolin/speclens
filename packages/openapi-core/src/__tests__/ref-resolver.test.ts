import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import { resolveRefs, RefResolutionError } from '../ref-resolver.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('resolveRefs', () => {
  it('resolves local $ref schemas cleanly', () => {
    const raw = yaml.parse(fs.readFileSync(path.join(fixturesDir, 'petstore-3.0.yaml'), 'utf8'));
    const resolved = resolveRefs<any>(raw, { privateMode: true });

    // The Pet schema allOf[0] was $ref: "#/components/schemas/NewPet"
    const petSchema = resolved.components.schemas.Pet;
    expect(petSchema.allOf[0].properties.name.type).toBe('string');
    expect(petSchema.allOf[1].properties.id.type).toBe('integer');
  });

  it('detects circular references and terminates safely without infinite recursion', () => {
    const raw = yaml.parse(fs.readFileSync(path.join(fixturesDir, 'cyclic-refs.yaml'), 'utf8'));
    const resolved = resolveRefs<any>(raw, { privateMode: true });

    const nodeSchema = resolved.components.schemas.Node;
    expect(nodeSchema).toBeDefined();
    expect(nodeSchema.properties.id.type).toBe('string');

    // Recursive children
    const childItem = nodeSchema.properties.children.items;
    expect(childItem).toBeDefined();
    // One of the recursive branches will detect the cycle
    expect(
      childItem.$refCycle === '#/components/schemas/Node' ||
      childItem.properties?.parent?.$refCycle === '#/components/schemas/Node' ||
      childItem.properties?.children?.items?.$refCycle === '#/components/schemas/Node'
    ).toBe(true);
  });

  it('rejects remote reference when privateMode=true', () => {
    const raw = yaml.parse(fs.readFileSync(path.join(fixturesDir, 'remote-ref.yaml'), 'utf8'));

    expect(() => {
      resolveRefs(raw, { privateMode: true });
    }).toThrowError(RefResolutionError);

    try {
      resolveRefs(raw, { privateMode: true });
    } catch (err: any) {
      expect(err.code).toBe('REMOTE_REF_FORBIDDEN');
      expect(err.message).toContain('privateMode=true');
    }
  });

  it('handles non-existent local reference with warning instead of crashing', () => {
    const broken = {
      openapi: '3.0.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/schemas/DoesNotExist',
              },
            },
          },
        },
      },
    };

    const warnings: string[] = [];
    const onWarning = vi.fn((w) => warnings.push(w));

    const resolved = resolveRefs<any>(broken, { privateMode: true, onWarning });

    expect(onWarning).toHaveBeenCalled();
    expect(warnings.some((w) => w.includes('DoesNotExist'))).toBe(true);
    expect(resolved.paths['/test'].get.responses['200'].$ref).toBe('#/components/schemas/DoesNotExist');
  });

  it('resolves oneOf and anyOf schemas', () => {
    const raw = yaml.parse(
      fs.readFileSync(path.join(fixturesDir, 'composition-and-multipart.yaml'), 'utf8')
    );
    const resolved = resolveRefs<any>(raw, { privateMode: true });

    const uploadResponseSchema =
      resolved.paths['/upload'].post.responses['200'].content['application/json'].schema;
    expect(uploadResponseSchema.oneOf).toHaveLength(2);
    expect(uploadResponseSchema.oneOf[0].properties.id.type).toBe('string');
    expect(uploadResponseSchema.oneOf[1].properties.warnings.type).toBe('array');
  });
});
