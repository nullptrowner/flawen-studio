import { describe, expect, it } from 'vitest';
import { createLayer } from '../src/types/project';
import { crackSvg } from '../src/effects/cracks';

describe('procedural cracks', () => {
  it('reproduces a seed and changes the fracture when seed changes', () => {
    const layer = createLayer('crack');
    expect(crackSvg(layer)).toBe(crackSvg(layer));
    expect(crackSvg(layer)).not.toBe(
      crackSvg({ ...layer, effect: { ...layer.effect, seed: 811 } }),
    );
    expect(crackSvg(layer)).toContain('viewBox="0 0 400 180"');
  });
});

import { defaultBackground, crackPresets } from '../src/types/project';
import { surfaceSvg } from '../src/effects/surface';
import { logoSvg } from '../src/branding/logo';

describe('surface painting', () => {
  it('restores prior damage through a mask without removing the base material', () => {
    const result = surfaceSvg(defaultBackground, 600, 400, [
      {
        id: 'scratch',
        mode: 'Scratch',
        points: [
          [20, 20],
          [200, 100],
        ],
        size: 30,
        hardness: 80,
        strength: 70,
        spacing: 10,
        opacity: 1,
        seed: 1,
      },
      {
        id: 'restore',
        mode: 'Restore clean surface',
        points: [
          [80, 40],
          [120, 60],
        ],
        size: 60,
        hardness: 90,
        strength: 100,
        spacing: 10,
        opacity: 1,
        seed: 2,
      },
    ]);
    expect(result).toContain('<mask');
    expect(result).toContain('mask="url(#restore-1)"');
    expect(result).toContain('fill="#f5f5f5"');
    expect(result.indexOf('fill="#f5f5f5"')).toBeLessThan(result.indexOf('mask="url(#restore-1)"'));
  });
});

describe('logo artwork', () => {
  it('uses standalone vector paths for every distinct lockup', () => {
    const variants = ['symbol', 'wordmark', 'horizontal', 'vertical', 'full'] as const;
    const results = variants.map((logoVariant) => logoSvg(createLayer('logo', { logoVariant })));
    expect(new Set(results).size).toBe(5);
    for (const result of results) {
      expect(result).toContain('<path');
      expect(result).not.toMatch(/<text|<image|<script|foreignObject/);
    }
  });
  it('gives each crack preset a different network', () => {
    const layer = createLayer('crack');
    const results = crackPresets.map((preset) =>
      crackSvg({ ...layer, effect: { ...layer.effect, preset } }),
    );
    expect(new Set(results).size).toBe(8);
  });
});

import { brushModes, materials } from '../src/types/project';
import { effectSvg } from '../src/effects/effects';

describe('portable SVG effects', () => {
  it('produces deterministic distinct material surfaces and brush modes', () => {
    const surfaces = materials.map((material) =>
      surfaceSvg({ ...defaultBackground, material }, 800, 600, []),
    );
    expect(new Set(surfaces).size).toBe(materials.length);
    expect(surfaces[0]).toBe(surfaceSvg(defaultBackground, 800, 600, []));
    const strokes = brushModes.map((mode) =>
      surfaceSvg(defaultBackground, 800, 600, [
        {
          id: 'test',
          mode,
          points: [
            [10, 20],
            [70, 50],
            [150, 90],
          ],
          size: 50,
          hardness: 60,
          strength: 90,
          spacing: 20,
          opacity: 0.8,
          seed: 45,
        },
      ]),
    );
    expect(new Set(strokes).size).toBe(brushModes.length);
    for (const result of [...surfaces, ...strokes])
      expect(result).not.toMatch(/NaN|Infinity|<image|<script|foreignObject/);
  });
  it('keeps each damage channel stable when a different channel seed changes', () => {
    const background = { ...defaultBackground, grain: 0, scratches: 45, cracks: 0, erosion: 0 };
    expect(surfaceSvg(background, 800, 600, [])).toBe(
      surfaceSvg({ ...background, seeds: { ...background.seeds, grain: 999 } }, 800, 600, []),
    );
    expect(surfaceSvg(background, 800, 600, [])).not.toBe(
      surfaceSvg({ ...background, seeds: { ...background.seeds, scratches: 999 } }, 800, 600, []),
    );
  });
  it('bounds generation for dense grain and records explicit dimensions', () => {
    for (const kind of ['grain', 'scratch', 'erosion', 'texture'] as const) {
      const layer = createLayer(kind, { width: 4096, height: 4096 });
      const result = effectSvg({ ...layer, effect: { ...layer.effect, intensity: 100 } });
      expect(result).toContain('width="4096" height="4096"');
      expect(result.length).toBeLessThan(220_000);
      expect(result).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('material restoration', () => {
  it('restores flat substrate while removing damage alone preserves material texture', () => {
    const stroke = {
      id: 'restore',
      points: [
        [50, 50],
        [150, 50],
      ] as [number, number][],
      size: 80,
      hardness: 100,
      strength: 100,
      spacing: 10,
      opacity: 1,
      seed: 1,
    };
    const background = { ...defaultBackground, roughness: 100, contrast: 100 };
    const restored = surfaceSvg(background, 300, 200, [
      { ...stroke, mode: 'Restore clean surface' },
    ]);
    const removed = surfaceSvg(background, 300, 200, [{ ...stroke, mode: 'Remove damage' }]);
    const mask = '<g mask="url(#restore-0)">';
    const texture = 'fill="url(#material-wash)"';
    expect(restored.indexOf(mask)).toBeLessThan(restored.indexOf(texture));
    expect(removed.indexOf(mask)).toBeGreaterThan(removed.indexOf(texture));
    expect(restored.indexOf('fill="#f5f5f5"')).toBeLessThan(restored.indexOf(mask));
    expect(restored).not.toBe(removed);
  });
});
