import type { Background, BrushStroke } from '../types/project';
import { n, path, seededRandom, svg } from './shared';

/** Sparse clustered vectors are intentionally used instead of raster noise filters. */
export function damageField(
  kind: 'grain' | 'scratch' | 'erosion' | 'texture',
  width: number,
  height: number,
  amount: number,
  seed: number,
  color = '#111111',
): string {
  if (!amount) return '';
  const random = seededRandom(seed);
  const shapes: string[] = [];
  const scale = Math.max(0.5, Math.min(width, height) / 720);
  const count = Math.round((kind === 'grain' ? 15 : kind === 'texture' ? 6 : 1.5) * amount);
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const opacity = ((0.04 + random() * 0.32) * amount) / 100;
    if (kind === 'scratch') {
      const length = (8 + random() * random() * 180) * scale;
      const drift = (random() - 0.5) * 15 * scale;
      shapes.push(
        `<path d="M${n(x)} ${n(y)} l${n(length * 0.4)} ${n(drift * 0.6)} l${n(length * 0.6)} ${n(drift)}" fill="none" stroke="${color}" stroke-width="${n((0.2 + random() * 0.7) * scale)}" opacity="${n(opacity)}"/>`,
      );
    } else if (kind === 'erosion') {
      const radius = (1 + random() * random() * 35) * scale;
      const points: [number, number][] = [];
      for (let j = 0; j < 10; j++) {
        const angle = (j * Math.PI) / 5;
        const r = radius * (0.4 + random() * 0.6);
        points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
      }
      shapes.push(`<path d="${path(points)} Z" fill="${color}" opacity="${n(opacity)}"/>`);
    } else if (kind === 'texture') {
      shapes.push(
        `<path d="M${n(x)} ${n(y)} q${n(3 * scale)} ${n((random() - 0.5) * 6 * scale)} ${n((3 + random() * 12) * scale)} ${n((random() - 0.5) * 4 * scale)}" fill="none" stroke="${color}" stroke-width="${n(0.3 * scale)}" opacity="${n(opacity)}"/>`,
      );
    } else {
      shapes.push(
        `<circle cx="${n(x)}" cy="${n(y)}" r="${n((0.15 + random() * 0.8) * scale)}" fill="${color}" opacity="${n(opacity)}"/>`,
      );
    }
  }
  return shapes.join('');
}

function materialTexture(background: Background, w: number, h: number): string {
  const random = seededRandom(background.seed);
  const roughness = background.roughness / 100;
  const material = background.material;
  const dark = material === 'Black material';
  const ink = dark ? '#ffffff' : '#111111';
  const shapes: string[] = [
    `<defs><radialGradient id="material-wash"><stop stop-color="${ink}"/><stop offset="1" stop-color="${ink}" stop-opacity="0"/></radialGradient><radialGradient id="material-light"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`,
  ];
  const contrast = background.contrast / 100;
  // Wide irregular translucent washes create material structure at viewing distance.
  const washes = material === 'Porcelain' ? 5 : material === 'Matte plaster' ? 24 : 14;
  for (let i = 0; i < washes; i++) {
    const x = random() * w;
    const y = random() * h;
    const rx = w * (0.12 + random() * 0.5);
    const ry = h * (0.03 + random() * 0.3);
    shapes.push(
      `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${i % 3 ? 'material-wash' : 'material-light'})" opacity="${n((0.035 + roughness * 0.12) * contrast)}"/>`,
    );
  }
  if (material === 'Porcelain') {
    shapes.push(
      `<path d="M0 ${n(h * 0.22)} Q${n(w * 0.4)} ${n(-h * 0.06)} ${n(w)} ${n(h * 0.12)} L${n(w)} 0 H0Z" fill="#ffffff" opacity=".24"/>`,
    );
  } else if (material === 'White paper' || material === 'Distressed print') {
    shapes.push(damageField('texture', w, h, 20 + roughness * 70, background.seed + 101, ink));
    if (material === 'Distressed print') {
      for (let i = 0; i < 26; i++) {
        const y = h * random();
        shapes.push(
          `<path d="M0 ${n(y)} H${n(w)}" stroke="${ink}" stroke-width="${n(0.3 + random() * 2)}" opacity="${n(0.008 + roughness * 0.022)}"/>`,
        );
      }
    }
  } else if (material === 'Rough industrial') {
    shapes.push(damageField('erosion', w, h, 30 + roughness * 60, background.seed + 19, ink));
    for (let i = 0; i < 18; i++) {
      const x = random() * w;
      shapes.push(
        `<path d="M${n(x)} 0 l${n((random() - 0.5) * w * 0.14)} ${n(h)}" stroke="${ink}" stroke-width="${n(1 + random() * 5)}" opacity="${n(0.015 + roughness * 0.025)}"/>`,
      );
    }
  } else {
    shapes.push(damageField('erosion', w, h, 12 + roughness * 35, background.seed + 93, ink));
    shapes.push(damageField('grain', w, h, 10 + roughness * 35, background.seed + 97, ink));
  }
  return shapes.join('');
}

function paintedStroke(stroke: BrushStroke): string {
  const random = seededRandom(stroke.seed);
  const opacity = (stroke.opacity * stroke.strength) / 100;
  // Keep full stroke data in the project; bound the generated preview/export geometry.
  const points =
    stroke.points.length > 650
      ? Array.from(
          { length: 650 },
          (_, i) => stroke.points[Math.round((i * (stroke.points.length - 1)) / 649)],
        )
      : stroke.points;
  const line = path(points);
  const mark = (color: string, width: number, extra = '') =>
    points.length === 1
      ? `<circle cx="${n(points[0][0])}" cy="${n(points[0][1])}" r="${n(width / 2)}" fill="${color}" ${extra}/>`
      : `<path d="${line}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  if (stroke.mode === 'Restore clean surface' || stroke.mode === 'Remove damage')
    return mark('#000000', stroke.size, `opacity="${n(opacity)}"`);
  if (stroke.mode === 'Erase material')
    return mark('#ffffff', stroke.size, `opacity="${n(opacity)}"`);
  if (stroke.mode === 'Crack') {
    const jittered = points.map(([x, y], i): [number, number] => [
      x + (i ? random() - 0.5 : 0) * stroke.size * 0.25,
      y + (i ? random() - 0.5 : 0) * stroke.size * 0.25,
    ]);
    return `<path d="${path(jittered)}" fill="none" stroke="#111111" stroke-width="${n(Math.max(0.4, stroke.size * 0.045))}" stroke-linecap="round" opacity="${n(opacity)}"/>`;
  }
  const shapes: string[] = [];
  // Resample by distance: a long pointer move and many short moves produce similar density.
  const step = Math.max(2, (stroke.size * stroke.spacing) / 100);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  const total = cumulative[cumulative.length - 1];
  const count = Math.min(650, Math.max(1, Math.ceil(total / step) + 1));
  const samples: [number, number][] = [];
  let segment = 1;
  for (let i = 0; i < count; i++) {
    const distance = count === 1 ? 0 : (total * i) / (count - 1);
    while (segment < points.length - 1 && cumulative[segment] < distance) segment++;
    if (points.length === 1) {
      samples.push(points[0]);
      continue;
    }
    const from = points[segment - 1],
      to = points[segment];
    const length = cumulative[segment] - cumulative[segment - 1];
    const fraction = length ? (distance - cumulative[segment - 1]) / length : 0;
    samples.push([from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]);
  }
  for (const [x, y] of samples) {
    const dx = (random() - 0.5) * stroke.size;
    const dy = (random() - 0.5) * stroke.size;
    if (stroke.mode === 'Scratch')
      shapes.push(
        `<path d="M${n(x + dx)} ${n(y + dy)} l${n(stroke.size * (0.2 + random() * 0.6))} ${n(stroke.size * (random() - 0.5) * 0.2)}" fill="none" stroke="#111111" stroke-width="${n(0.3 + stroke.size * 0.008)}"/>`,
      );
    else
      shapes.push(
        `<circle cx="${n(x + dx)}" cy="${n(y + dy)}" r="${n(stroke.size * (stroke.mode === 'Add dust' ? 0.008 + random() * 0.025 : 0.015 + random() * 0.12))}" fill="${stroke.mode === 'Add dust' ? '#777777' : '#222222'}"/>`,
      );
  }
  return `<g opacity="${n(opacity)}">${shapes.join('')}</g>`;
}

export function surfaceSvg(
  background: Background,
  width: number,
  height: number,
  strokes: BrushStroke[],
): string {
  const w = width,
    h = height;
  const ink = background.material === 'Black material' ? '#dddddd' : '#111111';
  const random = seededRandom(background.seeds.cracks);
  let damage =
    damageField('grain', w, h, background.grain, background.seeds.grain, ink) +
    damageField('scratch', w, h, background.scratches, background.seeds.scratches, ink) +
    damageField('erosion', w, h, background.erosion, background.seeds.erosion, ink) +
    damageField('texture', w, h, background.wear, background.seed + 271, ink) +
    damageField('grain', w, h, background.dust, background.seed + 397, '#888888');
  for (let i = 0; i < Math.ceil(background.cracks / 10); i++) {
    const x = random() * w,
      y = random() * h;
    const points: [number, number][] = [[x, y]];
    const length = (0.1 + random() * 0.5) * w;
    for (let j = 1; j < 12; j++)
      points.push([x + (length * j) / 12, y + (random() - 0.5) * length * 0.1 + j * length * 0.02]);
    damage += `<path d="${path(points)}" fill="none" stroke="${ink}" stroke-width="${n(0.3 + random())}" opacity="${n(background.cracks / 170)}"/>`;
  }
  const edgeRandom = seededRandom(background.seed + 601);
  for (let i = 0; i < background.edge * 2; i++) {
    const horizontal = i % 2 === 0,
      far = i % 4 < 2;
    const x = horizontal ? edgeRandom() * w : far ? w : 0;
    const y = horizontal ? (far ? h : 0) : edgeRandom() * h;
    const radius = ((2 + edgeRandom() * 15) * background.edge) / 100;
    damage += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(horizontal ? radius * 3 : radius)}" ry="${n(horizontal ? radius : radius * 3)}" fill="${ink}" opacity="${n(0.03 + edgeRandom() * 0.12)}"/>`;
  }
  const defs: string[] = [];
  let material = materialTexture(background, w, h);
  strokes.forEach((stroke, index) => {
    const blur = ((100 - stroke.hardness) / 100) * stroke.size * 0.12;
    const filter = blur > 0.1 ? ` filter="url(#brush-soft-${index})"` : '';
    if (blur > 0.1)
      defs.push(
        `<filter id="brush-soft-${index}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${n(blur)}"/></filter>`,
      );
    const mark = `<g${filter}>${paintedStroke(stroke)}</g>`;
    if (stroke.mode === 'Restore clean surface' || stroke.mode === 'Remove damage') {
      // Each restoration masks only preceding marks; subsequent painting remains visible.
      defs.push(
        `<mask id="restore-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n(w)}" height="${n(h)}" style="mask-type:luminance"><rect width="${n(w)}" height="${n(h)}" fill="#ffffff"/>${mark}</mask>`,
      );
      damage = `<g mask="url(#restore-${index})">${damage}</g>`;
      if (stroke.mode === 'Restore clean surface')
        material = `<g mask="url(#restore-${index})">${material}</g>`;
    } else damage += mark;
  });
  return svg(
    w,
    h,
    `<defs>${defs.join('')}</defs><rect width="${n(w)}" height="${n(h)}" fill="${background.color}"/>${material}${damage}`,
  );
}
