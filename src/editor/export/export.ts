import { StaticCanvas, Rect } from 'fabric';
import JSZip from 'jszip';
import type { Project, Layer } from '../../types/project';
import { populate } from '../canvas/render';
import { embeddedFonts } from './fonts';
import { download } from '../../utils/assets';
export interface ExportOptions {
  format: 'png' | 'webp' | 'svg' | 'json';
  width: number;
  height: number;
  scale: number;
  quality: number;
  transparent: boolean;
  layout: 'fit' | 'crop' | 'reflow';
}
export function exportSize(options: ExportOptions) {
  const width = Math.round(options.width * options.scale),
    height = Math.round(options.height * options.scale);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 64 ||
    height < 64 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 32_000_000
  )
    throw new Error('Export must be 64–8192 px per side and at most 32 megapixels.');
  return { width, height };
}
export function reflowProject(p: Project, width: number, height: number): Project {
  const copy = structuredClone(p),
    sx = width / p.width,
    sy = height / p.height,
    k = Math.min(sx, sy);
  function scale(layers: Layer[]) {
    for (const l of layers) {
      l.x *= sx;
      l.y *= sy;
      if (l.kind === 'text' || l.kind === 'group') {
        l.width *= sx;
        l.height *= sy;
        l.fontSize *= k;
      } else {
        l.width *= k;
        l.height *= k;
      }
      if (l.kind === 'group') scale(l.children);
    }
  }
  scale(copy.layers);
  copy.width = width;
  copy.height = height;
  copy.strokes = copy.strokes.map((s) => ({
    ...s,
    size: s.size * k,
    points: s.points.map(([x, y]) => [x * sx, y * sy]),
  }));
  return copy;
}
export async function exportBlob(project: Project, options: ExportOptions): Promise<Blob> {
  if (options.format === 'json')
    return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const { width, height } = exportSize(options);
  const p =
    options.layout === 'reflow' ? reflowProject(project, options.width, options.height) : project;
  const canvas = new StaticCanvas(undefined, {
    width: p.width,
    height: p.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    await populate(canvas, p, false, options.transparent);
    const factor = (options.layout === 'crop' ? Math.max : Math.min)(
        width / p.width,
        height / p.height,
      ),
      x = (width - p.width * factor) / 2,
      y = (height - p.height * factor) / 2;
    if (options.format === 'svg') {
      const source = canvas.toSVG({ suppressPreamble: true });
      const body = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>'));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${await embeddedFonts()}${options.transparent ? '' : `<rect width="${width}" height="${height}" fill="${p.background.color}"/>`}<defs><clipPath id="studio-artboard"><rect width="${p.width}" height="${p.height}"/></clipPath></defs><g transform="translate(${x} ${y}) scale(${factor})"><g clip-path="url(#studio-artboard)">${body}</g></g></svg>`;
      return new Blob([svg], { type: 'image/svg+xml' });
    }
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d');
    if (!ctx) throw new Error('Canvas export unavailable.');
    if (!options.transparent) {
      ctx.fillStyle = p.background.color;
      ctx.fillRect(0, 0, width, height);
    }
    canvas.setDimensions({ width, height });
    canvas.setViewportTransform([factor, 0, 0, factor, x, y]);
    canvas.clipPath = new Rect({
      left: 0,
      top: 0,
      width: p.width,
      height: p.height,
      originX: 'left',
      originY: 'top',
    });
    canvas.renderAll();
    ctx.drawImage(canvas.getElement(), 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      output.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed.'))),
        `image/${options.format}`,
        options.quality,
      ),
    );
  } finally {
    await canvas.dispose();
  }
}
export function fileName(p: Project, extension: string) {
  return (
    'flawen-' +
    p.name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-|-$/g, '') +
    '.' +
    extension
  );
}
export async function exportProject(project: Project, options: ExportOptions) {
  download(await exportBlob(project, options), fileName(project, options.format));
}
export async function exportBatch(
  projects: Project[],
  options: ExportOptions,
  onProgress: (done: number) => void,
) {
  if (!projects.length || projects.length > 30) throw new Error('Export 1–30 artworks per ZIP.');
  const zip = new JSZip();
  for (let i = 0; i < projects.length; i++) {
    const blob = await exportBlob(projects[i], options);
    zip.file(
      `${String(i + 1).padStart(2, '0')}-${fileName(projects[i], options.format)}`,
      await blob.arrayBuffer(),
    );
    onProgress(i + 1);
  }
  download(
    await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 3 },
    }),
    'flawen-studio-batch.zip',
  );
}
