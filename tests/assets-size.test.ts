import { describe, expect, it } from 'vitest';
import { createProject } from '../src/types/project';
import { importAsset, validateAssets } from '../src/utils/assets';

describe('embedded asset validation', () => {
  it('rejects oversized embedded data before decoding and preserves the original project', async () => {
    const project = createProject();
    project.assets = [
      {
        id: 'oversized',
        name: 'Large image',
        mime: 'image/png',
        width: 2000,
        height: 2000,
        data: 'data:image/png;base64,' + 'A'.repeat(8_000_000),
      },
    ];
    const original = project.assets[0].data;
    await expect(validateAssets(project)).rejects.toThrow('8 MB embedded limit');
    expect(project.assets[0].data).toBe(original);
  });
  it('rejects an external image URL even when called without the portable parser', async () => {
    const project = createProject();
    project.assets = [
      {
        id: 'external',
        name: 'Remote image',
        mime: 'image/png',
        width: 10,
        height: 10,
        data: 'https://example.invalid/image.png',
      },
    ];
    await expect(validateAssets(project)).rejects.toThrow('Only embedded assets');
  });
  it('rejects SVG markup disguised as PNG before the browser decodes it', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'image.png', {
      type: 'image/png',
    });
    await expect(importAsset(file)).rejects.toThrow('contents do not match');
    const project = createProject();
    project.assets = [
      {
        id: 'disguised',
        name: 'Image',
        mime: 'image/png',
        width: 10,
        height: 10,
        data: 'data:image/png;base64,' + btoa('<svg/>'),
      },
    ];
    await expect(validateAssets(project)).rejects.toThrow('contents do not match');
  });
  it('rejects corrupt base64 rather than accepting an undecodable image', async () => {
    const project = createProject();
    project.assets = [
      {
        id: 'corrupt',
        name: 'Image',
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        data: 'data:image/jpeg;base64,%%%',
      },
    ];
    await expect(validateAssets(project)).rejects.toThrow('Corrupt embedded asset');
  });
});
