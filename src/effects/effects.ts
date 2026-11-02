import type { Layer } from '../types/project';
import { crackSvg } from './cracks';
import { damageField } from './surface';
import { n, svg } from './shared';

export function effectSvg(layer: Layer): string {
  if (layer.kind === 'crack') return crackSvg(layer);
  const kind =
    layer.kind === 'scratch' || layer.kind === 'erosion' || layer.kind === 'texture'
      ? layer.kind
      : 'grain';
  return svg(
    layer.width,
    layer.height,
    `<g transform="rotate(${n(layer.effect.direction)} ${n(layer.width / 2)} ${n(layer.height / 2)})">${damageField(kind, layer.width, layer.height, layer.effect.intensity, layer.effect.seed, layer.color)}</g>`,
  );
}
