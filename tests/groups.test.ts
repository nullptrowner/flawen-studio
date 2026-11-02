import { describe, expect, it } from 'vitest';
import { createLayer, type Layer } from '../src/types/project';
import { groupLayers, ungroupLayer } from '../src/editor/groups';

function point(layer: Layer, x: number, y: number): [number, number] {
  const angle = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const cx = layer.x + (cos * layer.width) / 2 - (sin * layer.height) / 2;
  const cy = layer.y + (sin * layer.width) / 2 + (cos * layer.height) / 2;
  const dx = (x - layer.width / 2) * (layer.flipX ? -1 : 1);
  const dy = (y - layer.height / 2) * (layer.flipY ? -1 : 1);
  return [cx + cos * dx - sin * dy, cy + sin * dx + cos * dy];
}
const corners = (layer: Layer) =>
  [
    [0, 0],
    [layer.width, 0],
    [layer.width, layer.height],
    [0, layer.height],
  ].map(([x, y]) => point(layer, x, y));
function expectPoints(actual: number[][], expected: number[][]) {
  actual.forEach((p, i) => p.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 8)));
}

describe('group transforms', () => {
  it('groups rotated layers without changing corners and includes their full bounds', () => {
    const layers = [
      createLayer('shape', { x: 100, y: 200, width: 100, height: 50, rotation: 45, flipX: true }),
      createLayer('shape', { x: 350, y: 130, width: 80, height: 120, rotation: -30 }),
    ];
    const original = structuredClone(layers);
    const group = groupLayers(layers);
    group.children.forEach((child, i) => {
      expectPoints(
        corners(child).map(([x, y]) => point(group, x, y)),
        corners(layers[i]),
      );
      for (const [x, y] of corners(child)) {
        expect(x).toBeGreaterThanOrEqual(-1e-8);
        expect(y).toBeGreaterThanOrEqual(-1e-8);
        expect(x).toBeLessThanOrEqual(group.width + 1e-8);
        expect(y).toBeLessThanOrEqual(group.height + 1e-8);
      }
    });
    expect(layers).toEqual(original);
  });
});

describe('ungrouping', () => {
  it('preserves transformed corners for rotations and every parent/child reflection combination', () => {
    for (const rotation of [0, 37, 90, -135, 720]) {
      for (const flipX of [false, true])
        for (const flipY of [false, true]) {
          for (const childFlipX of [false, true])
            for (const childFlipY of [false, true]) {
              const child = createLayer('shape', {
                x: 20,
                y: 30,
                width: 70,
                height: 45,
                rotation: -28,
                flipX: childFlipX,
                flipY: childFlipY,
                opacity: 0.6,
              });
              const group = createLayer('group', {
                x: 100,
                y: 160,
                width: 300,
                height: 240,
                rotation,
                flipX,
                flipY,
                opacity: 0.4,
                children: [child],
              });
              const released = ungroupLayer(group)[0];
              expectPoints(
                corners(released),
                corners(child).map(([x, y]) => point(group, x, y)),
              );
              expect(released.opacity).toBeCloseTo(0.24);
              expect(released.id).toBe(child.id);
            }
        }
    }
  });
  it('matches the independently measured Fabric reflection fixture', () => {
    const group = createLayer('group', {
      x: 100,
      y: 100,
      width: 300,
      height: 100,
      flipX: true,
      children: [createLayer('shape', { x: 20, y: 20, width: 50, height: 30, rotation: 30 })],
    });
    expectPoints(corners(ungroupLayer(group)[0]), [
      [380, 120],
      [336.69872981077805, 145],
      [351.69872981077805, 170.98076211353316],
      [395, 145.98076211353316],
    ]);
  });
  it('retains nested transforms and hidden state without mutating the input', () => {
    const leaf = createLayer('shape', { x: 12, y: 27, width: 40, height: 20, rotation: 10 });
    const inner = createLayer('group', {
      x: 30,
      y: 60,
      width: 140,
      height: 110,
      rotation: 35,
      flipY: true,
      children: [leaf],
    });
    const outer = createLayer('group', {
      x: 200,
      y: 80,
      width: 400,
      height: 350,
      rotation: -20,
      flipX: true,
      visible: false,
      children: [inner],
    });
    const original = structuredClone(outer);
    const released = ungroupLayer(outer)[0];
    const final = ungroupLayer(released)[0];
    expectPoints(
      corners(final),
      corners(leaf)
        .map(([x, y]) => point(inner, x, y))
        .map(([x, y]) => point(outer, x, y)),
    );
    expect(final.visible).toBe(false);
    released.children[0].name = 'Changed';
    expect(outer).toEqual(original);
  });
  it('rejects invalid group operations', () => {
    expect(() => groupLayers([])).toThrow('Select at least one');
    expect(() => ungroupLayer(createLayer('shape'))).toThrow('Only groups');
  });
});
