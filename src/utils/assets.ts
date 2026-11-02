import { assetSchema, type Asset, type Project } from '../types/project';
const MAX_FILE = 8 * 1024 * 1024;
const MAX_ASSET_DATA = 8_000_000;
export function svgData(svg: string) {
  return 'data:image/svg+xml;base64,' + bytesToBase64(new TextEncoder().encode(svg));
}
function bytesToBase64(bytes: Uint8Array) {
  let raw = '';
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
}
// <use> is excluded: a small source can expand into an enormous reference tree.
const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'text',
  'tspan',
  'pattern',
  'title',
  'desc',
]);
const attrs = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'fill-rule',
  'clip-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
  'id',
  'clip-path',
  'mask',
  'maskUnits',
  'maskContentUnits',
  'gradientUnits',
  'gradientTransform',
  'offset',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'patternUnits',
  'patternTransform',
]);
const styleAttrs = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'fill-rule',
  'clip-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'clip-path',
  'mask',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
]);
function neutral(color: string) {
  if (['none', 'transparent', 'currentColor'].includes(color) || /^url\(#[\w-]+\)$/.test(color))
    return color;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#111111';
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#111111';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const gray = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
  if (a < 255) return `rgba(${gray}, ${gray}, ${gray}, ${Number((a / 255).toFixed(4))})`;
  return '#' + gray.toString(16).padStart(2, '0').repeat(3);
}
export function sanitizeSvg(source: string): string {
  if (source.length > MAX_FILE || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('SVG is oversized or contains unsupported entities.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw new Error('Invalid SVG file.');
  const elements = [doc.documentElement, ...doc.documentElement.querySelectorAll('*')];
  if (elements.length > 10000) throw new Error('SVG exceeds 10,000 elements.');
  for (const el of elements) {
    if (!tags.has(el.localName))
      throw new Error(`Unsupported SVG element: ${el.localName}. Use paths and shapes.`);
    if (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/2000/svg')
      throw new Error('Only SVG elements are supported.');
    let depth = 0;
    for (let parent = el.parentElement; parent; parent = parent.parentElement)
      if (++depth > 32) throw new Error('SVG nesting exceeds 32 levels.');
    for (const attr of [...el.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        (/javascript:|https?:|data:|\/\/|@import|\\/i.test(attr.value) &&
          attr.name !== 'xmlns' &&
          attr.name !== 'xmlns:xlink')
      )
        throw new Error('External resources and executable SVG content are not allowed.');
      if (attr.name === 'href' || attr.localName === 'href')
        throw new Error('SVG references must be expanded to paths before import.');
      if (attr.name === 'style') {
        for (const rule of attr.value.split(';')) {
          const [key, ...rest] = rule.split(':');
          if (styleAttrs.has(key.trim())) el.setAttribute(key.trim(), rest.join(':').trim());
        }
        el.removeAttribute('style');
      } else if (!attrs.has(attr.name)) el.removeAttribute(attr.name);
    }
    for (const attr of [...el.attributes]) {
      if (/url\s*\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))
        throw new Error('Unsafe SVG reference.');
      if (['fill', 'stroke', 'stop-color'].includes(attr.name))
        el.setAttribute(attr.name, neutral(attr.value));
    }
  }
  const root = doc.documentElement;
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.getAttribute('viewBox')) {
    const w = parseFloat(root.getAttribute('width') || '512'),
      h = parseFloat(root.getAttribute('height') || '512');
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
      throw new Error('SVG requires positive dimensions.');
    root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  const dims = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  if (
    dims.length !== 4 ||
    dims.some((v) => !Number.isFinite(v)) ||
    dims[2] <= 0 ||
    dims[3] <= 0 ||
    dims[2] > 8192 ||
    dims[3] > 8192
  )
    throw new Error('SVG viewBox is invalid or too large.');
  root.setAttribute('width', String(dims[2]));
  root.setAttribute('height', String(dims[3]));
  return new XMLSerializer().serializeToString(root);
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = src;
  });
}
function assertDataSize(data: string) {
  if (data.length > MAX_ASSET_DATA)
    throw new Error(
      'Processed image exceeds the 8 MB embedded limit. Resize or simplify it before importing.',
    );
}
function checkedAsset(asset: Asset): Asset {
  assertDataSize(asset.data);
  return assetSchema.parse(asset);
}
function assertImageSize(img: HTMLImageElement) {
  if (
    !img.naturalWidth ||
    !img.naturalHeight ||
    img.naturalWidth > 8192 ||
    img.naturalHeight > 8192 ||
    img.naturalWidth * img.naturalHeight > 24_000_000
  )
    throw new Error('Image is too large or invalid (8192 px / 24 megapixels maximum).');
}
function grayscaleImage(img: HTMLImageElement): string {
  assertImageSize(img);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing unavailable.');
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(img, 0, 0);
  const data = canvas.toDataURL('image/png');
  assertDataSize(data);
  return data;
}
function assertRasterSignature(bytes: Uint8Array, mime: string) {
  const valid =
    mime === 'image/png'
      ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
      : mime === 'image/jpeg'
        ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === 'image/webp'
          ? bytes.length >= 12 &&
            String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
          : false;
  if (!valid) throw new Error('Image contents do not match the declared PNG, JPEG or WebP type.');
}
export async function importAsset(file: File): Promise<Asset> {
  if (file.size > MAX_FILE) throw new Error('Maximum upload size is 8 MB.');
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const source = sanitizeSvg(await file.text()),
      data = svgData(source);
    assertDataSize(data);
    const img = await loadImage(data);
    assertImageSize(img);
    return checkedAsset({
      id: crypto.randomUUID(),
      name: file.name,
      mime: 'image/svg+xml',
      data,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Upload SVG, PNG, JPEG or WebP.');
  assertRasterSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return checkedAsset({
      id: crypto.randomUUID(),
      name: file.name,
      mime: 'image/png',
      data: grayscaleImage(img),
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function validateAssets(project: Project): Promise<Project> {
  const copy = structuredClone(project);
  for (const asset of copy.assets) {
    assertDataSize(asset.data);
    if (!asset.data.startsWith(`data:${asset.mime};base64,`))
      throw new Error('Only embedded assets are supported.');
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(asset.data.slice(asset.data.indexOf(',') + 1)), (c) =>
        c.charCodeAt(0),
      );
    } catch {
      throw new Error('Corrupt embedded asset.');
    }
    if (asset.mime === 'image/svg+xml') {
      asset.data = svgData(sanitizeSvg(new TextDecoder().decode(bytes)));
      assertDataSize(asset.data);
      const img = await loadImage(asset.data);
      assertImageSize(img);
      asset.width = img.naturalWidth;
      asset.height = img.naturalHeight;
    } else {
      assertRasterSignature(bytes, asset.mime);
      const img = await loadImage(asset.data);
      asset.data = grayscaleImage(img);
      asset.mime = 'image/png';
      asset.width = img.naturalWidth;
      asset.height = img.naturalHeight;
    }
    checkedAsset(asset);
  }
  return copy;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
