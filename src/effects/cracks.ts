import type { Layer } from '../types/project';
import { n, path, seededRandom, svg } from './shared';

type Point = [number, number];
/** A bounded vector fracture network; direction is measured clockwise from horizontal. */
export function crackSvg(layer: Layer): string {
  const { width: w, height: h, effect: e } = layer;
  const random = seededRandom(e.seed);
  const preset = e.preset;
  const radial = preset === 'Impact fracture' || preset === 'Fine spiderweb crack';
  const split = preset === 'Surface split' || preset === 'Structural rupture';
  const fine = preset === 'Hairline fracture' || preset === 'Fine spiderweb crack';
  const angle = (e.direction * Math.PI) / 180;
  const length = Math.min(e.length, Math.hypot(w, h) * 0.95);
  const root: Point =
    preset === 'Edge fracture'
      ? [w * 0.02, h * 0.12]
      : radial
        ? [w * 0.47, h * 0.48]
        : [w / 2 - Math.cos(angle) * length * 0.46, h / 2 - Math.sin(angle) * length * 0.46];
  const thickness = e.thickness * (fine ? 0.38 : split ? 1.8 : 1);
  const opacity = e.intensity / 100;
  const shapes: string[] = [];
  const arms: Point[][] = [];
  const armCount = radial
    ? preset === 'Fine spiderweb crack'
      ? 9
      : 7
    : preset === 'Branching crack'
      ? 2
      : 1;
  const makeLine = (
    start: Point,
    direction: number,
    distance: number,
    segments: number,
  ): Point[] => {
    const points: Point[] = [start];
    for (let i = 1; i <= segments; i++) {
      const offset =
        (random() - 0.5) *
        distance *
        (0.012 + e.irregularity / 750) *
        Math.sin((Math.PI * i) / segments);
      points.push([
        start[0] + (Math.cos(direction) * distance * i) / segments - Math.sin(direction) * offset,
        start[1] + (Math.sin(direction) * distance * i) / segments + Math.cos(direction) * offset,
      ]);
    }
    return points;
  };
  const add = (points: Point[], weight: number) => {
    if (split && weight > thickness * 0.6) {
      const underside = [...points]
        .reverse()
        .map(([x, y], i): Point => [
          x,
          y + weight * (0.25 + Math.sin((i * Math.PI) / points.length)),
        ]);
      shapes.push(
        `<path d="${path(points)} ${path(underside).replace('M', 'L')} Z" fill="${layer.color}"/>`,
      );
    }
    shapes.push(
      `<path d="${path(points)}" fill="none" stroke="${layer.color}" stroke-width="${n(weight)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  };
  for (let arm = 0; arm < armCount; arm++) {
    const direction =
      angle + (radial ? (arm * Math.PI * 2) / armCount + random() * 0.2 : arm * 0.3);
    const distance = length * (radial ? 0.34 + random() * 0.17 : 1);
    const points = makeLine(root, direction, distance, preset === 'Porcelain crack' ? 7 : 18);
    arms.push(points);
    add(points, thickness * (0.75 + random() * 0.4));
  }
  const branches = Math.min(
    40,
    Math.round(((e.branchCount * e.branching) / 100) * (preset === 'Branching crack' ? 1.7 : 1)),
  );
  for (let i = 0; i < branches; i++) {
    const arm = arms[i % arms.length];
    const index = 1 + Math.floor(random() * (arm.length - 2));
    const start = arm[index];
    const next = arm[index + 1];
    const direction =
      Math.atan2(next[1] - start[1], next[0] - start[0]) +
      (i % 2 ? 1 : -1) * (0.25 + random() * 0.9);
    const points = makeLine(start, direction, length * (0.07 + random() * 0.25), 8);
    add(points, thickness * (0.22 + random() * 0.35));
    if (preset === 'Structural rupture')
      add(makeLine(points[3], direction + 0.7, length * 0.08, 4), thickness * 0.2);
  }
  if (radial) {
    const rings = preset === 'Fine spiderweb crack' ? 4 : 2;
    for (let ring = 1; ring <= rings; ring++) {
      const index = Math.min(17, ring * (preset === 'Fine spiderweb crack' ? 3 : 4));
      const points = arms.map((arm) => arm[index]);
      points.push(points[0]);
      add(points, thickness * 0.4);
    }
  }
  return svg(w, h, `<g opacity="${n(opacity)}">${shapes.join('')}</g>`);
}
