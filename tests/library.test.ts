import { describe, it, expect } from 'vitest';
import { createLayer, createProject, type Asset } from '../src/types/project';
import { createLibraryEntry, parseLibraryEntry } from '../src/persistence/library';
describe('portable library variants', () => {
  it('retains the uploaded master when used in a different project', () => {
    const asset: Asset = {
      id: 'logo-master',
      name: 'logo.svg',
      mime: 'image/svg+xml',
      data: 'data:image/svg+xml;base64,PHN2Zy8+',
      width: 200,
      height: 100,
    };
    const logo = createLayer('logo', { assetId: asset.id });
    const entry = createLibraryEntry(
      logo,
      createProject('Source', { layers: [logo], assets: [asset] }),
    );
    const restored = parseLibraryEntry(JSON.parse(JSON.stringify(entry)));
    expect(restored?.assets).toEqual([asset]);
    expect(restored?.layer.assetId).toBe(restored?.assets[0].id);
  });
  it('accepts legacy built-in styles but rejects orphaned uploaded masters', () => {
    expect(parseLibraryEntry(createLayer('text'))?.assets).toEqual([]);
    expect(parseLibraryEntry(createLayer('logo', { assetId: 'missing' }))).toBeNull();
  });
});
