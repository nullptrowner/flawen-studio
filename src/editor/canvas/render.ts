import {
  Canvas,
  StaticCanvas,
  FabricImage,
  Textbox,
  Group,
  Rect,
  LayoutManager,
  FixedLayout,
  type FabricObject,
} from 'fabric';
import { type Layer, type Project } from '../../types/project';
import { logoSvg } from '../../branding/logo';
import { crackSvg } from '../../effects/cracks';
import { effectSvg } from '../../effects/effects';
import { surfaceSvg } from '../../effects/surface';
import { svgData } from '../../utils/assets';
import { ungroupLayer } from '../groups';
function worldLayer(layers: Layer[], id: string): Layer | undefined {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.kind === 'group') {
      const child = worldLayer(ungroupLayer(l), id);
      if (child) return child;
    }
  }
  return undefined;
}
export const objectIds = new WeakMap<FabricObject, string>();
export function effectiveFont(layer: Layer) {
  const name =
    layer.fontFamily === 'Space Grotesk' && /[А-Яа-яЁё]/.test(layer.text)
      ? 'Inter'
      : layer.fontFamily;
  return name === 'IBM Plex Mono' ? name : name + ' Variable';
}
let fontPromise: Promise<unknown> | undefined;
export function readyFonts() {
  return (fontPromise ??= Promise.all(
    ['Inter Variable', 'Roboto Flex Variable', 'Space Grotesk Variable', 'IBM Plex Mono'].flatMap(
      (font) =>
        [400, 700, 800].map((weight) =>
          document.fonts.load(`${weight} 16px "${font}"`, 'FLAWEN Сессия'),
        ),
    ),
  ));
}
function elementSvg(l: Layer) {
  const w = l.width,
    h = l.height,
    s = l.strokeWidth,
    c = l.color;
  let body = '';
  switch (l.shape) {
    case 'circle':
      body = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max(1, w / 2 - s)}" ry="${Math.max(1, h / 2 - s)}" fill="${l.kind === 'frame' ? 'none' : c}" stroke="${l.stroke}" stroke-width="${s}"/>`;
      break;
    case 'grid':
      for (let x = 0; x <= w; x += Math.max(20, w / 10)) body += `<path d="M${x} 0V${h}"/>`;
      for (let y = 0; y <= h; y += Math.max(20, h / 8)) body += `<path d="M0 ${y}H${w}"/>`;
      body = `<g stroke="${c}" stroke-width="${s}" fill="none">${body}</g>`;
      break;
    case 'dots':
      for (let x = 8; x < w; x += 24)
        for (let y = 8; y < h; y += 24) body += `<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`;
      break;
    case 'crosshair':
    case 'registration':
      body = `<path d="M${w / 2} 0V${h}M0 ${h / 2}H${w}" stroke="${c}" stroke-width="${s}"/>${l.shape === 'registration' ? `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.3}" fill="none" stroke="${c}" stroke-width="${s}"/>` : ''}`;
      break;
    case 'corners':
      body = `<path d="M0 ${h * 0.2}V0H${w * 0.2}M${w * 0.8} 0H${w}V${h * 0.2}M${w} ${h * 0.8}V${h}H${w * 0.8}M${w * 0.2} ${h}H0V${h * 0.8}" fill="none" stroke="${c}" stroke-width="${s}"/>`;
      break;
    case 'fragments':
      body = `<path d="M0 0H${w * 0.43}L${w * 0.35} ${h * 0.62}H0ZM${w * 0.5} 0H${w}V${h * 0.4}L${w * 0.45} ${h * 0.65}ZM${w * 0.4} ${h * 0.75}L${w} ${h * 0.5}V${h}H${w * 0.3}Z" fill="${c}"/>`;
      break;
    default:
      body =
        l.kind === 'line'
          ? `<path d="M0 ${h / 2}H${w}" stroke="${c}" stroke-width="${s}"/>`
          : `<rect x="${s / 2}" y="${s / 2}" width="${Math.max(1, w - s)}" height="${Math.max(1, h - s)}" fill="${l.kind === 'frame' ? 'none' : c}" stroke="${l.stroke}" stroke-width="${s}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
const imageCache = new Map<string, HTMLImageElement>();
async function imageObject(source: string) {
  let element = imageCache.get(source);
  if (!element) {
    const image = await FabricImage.fromURL(source);
    const loaded = image.getElement();
    if (!(loaded instanceof HTMLImageElement)) throw new Error('Unsupported image source');
    element = loaded;
    imageCache.set(source, element);
    if (imageCache.size > 90) imageCache.delete(imageCache.keys().next().value ?? '');
    return image;
  }
  return new FabricImage(element);
}
export async function renderLayer(
  l: Layer,
  p: Project,
  interactive = false,
): Promise<FabricObject> {
  let obj: FabricObject;
  if (l.kind === 'text') {
    const text = l.uppercase ? l.text.toUpperCase() : l.text;
    obj = new Textbox(text, {
      width: l.width,
      fontSize: l.fontSize,
      fontFamily: effectiveFont(l),
      fontWeight: l.fontWeight,
      lineHeight: l.lineHeight,
      charSpacing: l.letterSpacing,
      textAlign: l.align,
      fill: l.outline ? 'transparent' : l.color,
      stroke: l.outline ? l.color : undefined,
      strokeWidth: l.outline ? Math.max(0.5, l.strokeWidth) : 0,
      splitByGrapheme: false,
      padding: 0,
      editable: interactive && !l.locked,
    });
  } else if (l.kind === 'group') {
    const children = await Promise.all(
      l.children.filter((c) => c.visible).map((c) => renderLayer(c, p, false)),
    );
    const bounds = new Rect({
      left: 0,
      top: 0,
      width: l.width,
      height: l.height,
      originX: 'left',
      originY: 'top',
      opacity: 0,
      strokeWidth: 0,
      selectable: false,
    });
    const positions = [bounds, ...children].map((child) => ({ left: child.left, top: child.top }));
    obj = new Group([bounds, ...children], {
      width: l.width,
      height: l.height,
      layoutManager: new LayoutManager(new FixedLayout()),
      subTargetCheck: false,
      objectCaching: false,
    });
    [bounds, ...children].forEach((child, index) =>
      child.set({
        left: positions[index].left - l.width / 2,
        top: positions[index].top - l.height / 2,
      }),
    );
  } else {
    let src: string;
    if (l.assetId) {
      const asset = p.assets.find((a) => a.id === l.assetId);
      if (!asset) throw new Error(`Missing asset for ${l.name}`);
      src = asset.data;
    } else {
      src = svgData(
        l.kind === 'logo'
          ? logoSvg(l)
          : l.kind === 'crack'
            ? crackSvg(l)
            : ['scratch', 'grain', 'erosion', 'texture'].includes(l.kind)
              ? effectSvg(l)
              : elementSvg(l),
      );
    }
    obj = await imageObject(src);
    obj.set({ scaleX: l.width / obj.width, scaleY: l.height / obj.height });
  }
  const offset =
    l.kind === 'text'
      ? Math.max(0, l.height - obj.height) *
        (l.verticalAlign === 'middle' ? 0.5 : l.verticalAlign === 'bottom' ? 1 : 0)
      : 0;
  obj.set({
    left: l.x - Math.sin((l.rotation * Math.PI) / 180) * offset,
    top: l.y + Math.cos((l.rotation * Math.PI) / 180) * offset,
    originX: 'left',
    originY: 'top',
    angle: l.rotation,
    opacity: l.opacity,
    flipX: l.flipX,
    flipY: l.flipY,
    visible: l.visible,
    selectable: interactive && !l.locked,
    evented: interactive && !l.locked,
    lockMovementX: l.locked,
    lockMovementY: l.locked,
    lockRotation: l.locked,
    lockScalingX: l.locked,
    lockScalingY: l.locked,
    borderColor: '#777777',
    cornerColor: '#ffffff',
    cornerStrokeColor: '#111111',
    transparentCorners: false,
    cornerSize: 9,
    padding: 2,
  });
  if (l.clipId) {
    const target = worldLayer(p.layers, l.clipId);
    if (target) {
      obj.clipPath = new Rect({
        left: target.x,
        top: target.y,
        width: target.width,
        height: target.height,
        angle: target.rotation,
        absolutePositioned: true,
        originX: 'left',
        originY: 'top',
      });
    }
  }
  objectIds.set(obj, l.id);
  return obj;
}
export async function populate(
  canvas: Canvas | StaticCanvas,
  p: Project,
  interactive = false,
  transparent = false,
  accept: () => boolean = () => true,
) {
  await readyFonts();
  const background = transparent
    ? undefined
    : await imageObject(svgData(surfaceSvg(p.background, p.width, p.height, p.strokes)));
  const objects = await Promise.all(
    p.layers.filter((l) => l.visible).map((l) => renderLayer(l, p, interactive)),
  );
  if (!accept() || canvas.disposed) {
    for (const obj of objects) obj.dispose();
    background?.dispose();
    return [];
  }
  if (canvas instanceof Canvas) canvas.discardActiveObject();
  for (const obj of canvas.getObjects()) obj.dispose();
  canvas.backgroundImage?.dispose();
  canvas.clear();
  canvas.backgroundImage = background;
  if (background)
    background.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
    });
  canvas.add(...objects);
  canvas.renderAll();
  return objects;
}
export async function projectThumbnail(p: Project, width = 320) {
  const c = new StaticCanvas(undefined, {
    width: p.width,
    height: p.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    await populate(c, p);
    return c.toDataURL({ format: 'png', multiplier: width / p.width });
  } finally {
    await c.dispose();
  }
}
