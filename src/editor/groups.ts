import { createLayer, type Layer } from '../types/project';

type Point = { x: number; y: number };
function rotate(x: number, y: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}
function center(layer: Layer): Point {
  const offset = rotate(layer.width / 2, layer.height / 2, layer.rotation);
  return { x: layer.x + offset.x, y: layer.y + offset.y };
}

// Fabric's left/top origin is the unreflected, rotated corner. Reflection
// happens around the object center, not around that origin.
function transformPoint(layer: Layer, x: number, y: number): Point {
  const midpoint = center(layer);
  const offset = rotate(
    (x - layer.width / 2) * (layer.flipX ? -1 : 1),
    (y - layer.height / 2) * (layer.flipY ? -1 : 1),
    layer.rotation,
  );
  return { x: midpoint.x + offset.x, y: midpoint.y + offset.y };
}

export function groupLayers(layers: Layer[]): Layer {
  if (!layers.length) throw new Error('Select at least one layer to group.');
  const corners = layers.flatMap((layer) =>
    [
      [0, 0],
      [layer.width, 0],
      [layer.width, layer.height],
      [0, layer.height],
    ].map(([x, y]) => transformPoint(layer, x, y)),
  );
  const x = Math.min(...corners.map((point) => point.x));
  const y = Math.min(...corners.map((point) => point.y));
  const width = Math.max(...corners.map((point) => point.x)) - x;
  const height = Math.max(...corners.map((point) => point.y)) - y;
  return createLayer('group', {
    name: 'GROUP',
    x,
    y,
    width,
    height,
    children: layers.map((layer) => ({
      ...structuredClone(layer),
      x: layer.x - x,
      y: layer.y - y,
    })),
  });
}

export function ungroupLayer(group: Layer): Layer[] {
  if (group.kind !== 'group') throw new Error('Only groups can be ungrouped.');
  const reflection = group.flipX !== group.flipY ? -1 : 1;
  return group.children.map((child) => {
    const midpoint = center(child);
    const worldCenter = transformPoint(group, midpoint.x, midpoint.y);
    const rotation = (((group.rotation + reflection * child.rotation) % 360) + 360) % 360;
    const offset = rotate(child.width / 2, child.height / 2, rotation);
    return {
      ...structuredClone(child),
      x: worldCenter.x - offset.x,
      y: worldCenter.y - offset.y,
      rotation,
      flipX: child.flipX !== group.flipX,
      flipY: child.flipY !== group.flipY,
      opacity: child.opacity * group.opacity,
      visible: child.visible && group.visible,
    };
  });
}
