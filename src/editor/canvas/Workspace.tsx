import { useEffect, useRef } from 'react';
import { Canvas, ActiveSelection, Point, Rect, type FabricObject } from 'fabric';
import { useEditor, findLayer, cloneLayer } from '../store';
import { populate, objectIds } from './render';
import type { BrushStroke, Layer } from '../../types/project';
import { importAsset } from '../../utils/assets';
import { createLayer } from '../../types/project';
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
export function Workspace() {
  const host = useRef<HTMLDivElement>(null),
    overlay = useRef<HTMLCanvasElement>(null);
  const ready = useEditor((s) => s.ready);
  useEffect(() => {
    if (!host.current || !ready) return;
    const container = host.current,
      element = document.createElement('canvas');
    container.prepend(element);
    const canvas = new Canvas(element, {
      preserveObjectStacking: true,
      selection: true,
      enableRetinaScaling: true,
      renderOnAddRemove: false,
      uniformScaling: true,
      enablePointerEvents: true,
    });
    canvas.wrapperEl.classList.add('fabric-wrapper');
    let disposed = false,
      synchronizing = false,
      revision = 0,
      renderTimer = 0,
      pan = false,
      space = false,
      last = { x: 0, y: 0 },
      stroke: BrushStroke | undefined;
    let clipboard: Layer[] = [];
    let width = 1,
      height = 1;
    const paintOverlay = () => {
      const guide = overlay.current;
      if (!guide) return;
      const ctx = guide.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      if (guide.width !== width * dpr || guide.height !== height * dpr) {
        guide.width = width * dpr;
        guide.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const s = useEditor.getState(),
        p = s.project,
        v = canvas.viewportTransform,
        z = canvas.getZoom();
      if (s.guides && !s.preview) {
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 0.7;
        ctx.setLineDash([4, 5]);
        ctx.strokeRect(
          v[4] + p.width * 0.05 * z,
          v[5] + p.height * 0.05 * z,
          p.width * 0.9 * z,
          p.height * 0.9 * z,
        );
        ctx.setLineDash([]);
        ctx.fillStyle = '#151515';
        ctx.fillRect(0, 0, width, 20);
        ctx.fillRect(0, 0, 20, height);
        ctx.font = '8px "IBM Plex Mono"';
        ctx.fillStyle = '#999999';
        ctx.strokeStyle = '#555555';
        const step = z < 0.35 ? 200 : 100;
        for (let x = 0; x <= p.width; x += step) {
          const px = v[4] + x * z;
          if (px > 20 && px < width) {
            ctx.fillText(String(x), px + 3, 12);
            ctx.beginPath();
            ctx.moveTo(px, 16);
            ctx.lineTo(px, 20);
            ctx.stroke();
          }
        }
        for (let y = 0; y <= p.height; y += step) {
          const py = v[5] + y * z;
          if (py > 20 && py < height) {
            ctx.save();
            ctx.translate(12, py + 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(String(y), 0, 0);
            ctx.restore();
          }
        }
        ctx.strokeStyle = '#aaaaaa';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(v[4] + (p.width * z) / 2, v[5]);
        ctx.lineTo(v[4] + (p.width * z) / 2, v[5] + p.height * z);
        ctx.stroke();
      }
      if (stroke) {
        ctx.setTransform(z * dpr, 0, 0, z * dpr, v[4] * dpr, v[5] * dpr);
        ctx.strokeStyle =
          stroke.mode.includes('Restore') || stroke.mode === 'Remove damage'
            ? '#eeeeee99'
            : '#77777788';
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        stroke.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    };
    canvas.on('after:render', paintOverlay);
    const fit = () => {
      const s = useEditor.getState(),
        z = Math.min((width - 100) / s.project.width, (height - 100) / s.project.height, 1);
      canvas.setViewportTransform([
        z,
        0,
        0,
        z,
        (width - s.project.width * z) / 2,
        (height - s.project.height * z) / 2,
      ]);
      useEditor.setState({ zoom: z });
    };
    const resize = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      canvas.setDimensions({ width, height });
      fit();
    });
    resize.observe(container);
    const synchronize = async () => {
      const current = ++revision,
        s = useEditor.getState();
      synchronizing = true;
      try {
        const objects = await populate(
          canvas,
          s.project,
          !s.preview,
          false,
          () => !disposed && revision === current,
        );
        if (disposed || current !== revision) return;
        canvas.clipPath = new Rect({
          left: 0,
          top: 0,
          width: s.project.width,
          height: s.project.height,
          originX: 'left',
          originY: 'top',
        });
        canvas.selection = s.tool === 'select' && !s.preview;
        for (const obj of objects) {
          const l = findLayer(s.project.layers, objectIds.get(obj) ?? '');
          obj.selectable = s.tool === 'select' && !s.preview && !l?.locked;
          obj.evented = obj.selectable;
        }
        const selected = objects.filter((o) => s.selection.includes(objectIds.get(o) ?? ''));
        if (selected.length === 1) canvas.setActiveObject(selected[0]);
        else if (selected.length > 1)
          canvas.setActiveObject(new ActiveSelection(selected, { canvas }));
        canvas.requestRenderAll();
      } catch (error) {
        if (!disposed)
          useEditor.setState({
            error: error instanceof Error ? error.message : 'Canvas rendering failed.',
          });
      } finally {
        if (current === revision) synchronizing = false;
      }
    };
    void synchronize();
    const unsub = useEditor.subscribe((s, old) => {
      if (s.project !== old.project || s.preview !== old.preview) {
        clearTimeout(renderTimer);
        renderTimer = window.setTimeout(() => void synchronize(), 45);
      } else if (s.selection !== old.selection && !synchronizing) {
        synchronizing = true;
        canvas.discardActiveObject();
        const objects = canvas
          .getObjects()
          .filter((o) => s.selection.includes(objectIds.get(o) ?? ''));
        if (objects.length === 1) canvas.setActiveObject(objects[0]);
        else if (objects.length > 1)
          canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        synchronizing = false;
      }
      if (s.fitRequest !== old.fitRequest) fit();
      else if (s.zoom !== old.zoom && Math.abs(canvas.getZoom() - s.zoom) > 0.0001) {
        canvas.zoomToPoint(new Point(width / 2, height / 2), s.zoom);
        canvas.requestRenderAll();
      }
      if (s.tool !== old.tool || s.preview !== old.preview) {
        canvas.selection = s.tool === 'select' && !s.preview;
        canvas.defaultCursor =
          s.tool === 'pan' ? 'grab' : s.tool === 'brush' ? 'crosshair' : 'default';
        for (const o of canvas.getObjects()) {
          const l = findLayer(s.project.layers, objectIds.get(o) ?? '');
          o.selectable = s.tool === 'select' && !s.preview && !l?.locked;
          o.evented = o.selectable;
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      if (s.guides !== old.guides) paintOverlay();
    });
    const selection = () => {
      if (!synchronizing)
        useEditor.getState().select(
          canvas
            .getActiveObjects()
            .map((o) => objectIds.get(o))
            .filter((id): id is string => !!id),
        );
    };
    canvas.on('selection:created', selection);
    canvas.on('selection:updated', selection);
    canvas.on('selection:cleared', selection);
    function commitObjects(objects: FabricObject[]) {
      const patches = objects
        .map((obj) => {
          const id = objectIds.get(obj),
            l = id ? findLayer(useEditor.getState().project.layers, id) : undefined;
          if (!l) return null;
          const point = obj.getXY(),
            scale = obj.getObjectScaling();
          const patch: Partial<Layer> = {
            x: point.x,
            y: point.y,
            width: Math.max(1, obj.width * Math.abs(scale.x)),
            height: Math.max(1, obj.height * Math.abs(scale.y)),
            rotation: obj.getTotalAngle(),
            flipX: obj.flipX,
            flipY: obj.flipY,
          };
          if (l.kind === 'text' && 'text' in obj && typeof obj.text === 'string') {
            patch.text = obj.text;
            patch.fontSize = l.fontSize * Math.abs(scale.x);
          }
          return { id: l.id, patch };
        })
        .filter((v): v is { id: string; patch: Partial<Layer> } => !!v);
      useEditor.getState().change('Layer transformed', (p) => {
        for (const { id, patch } of patches) {
          const l = findLayer(p.layers, id);
          if (!l) continue;
          if (l.kind === 'group') {
            const sx = (patch.width ?? l.width) / l.width,
              sy = (patch.height ?? l.height) / l.height;
            function scaleChildren(items: Layer[]) {
              for (const child of items) {
                child.x *= sx;
                child.y *= sy;
                child.width *= sx;
                child.height *= sy;
                child.fontSize *= Math.min(sx, sy);
                scaleChildren(child.children);
              }
            }
            scaleChildren(l.children);
          }
          Object.assign(l, patch);
        }
      });
    }
    canvas.on('object:modified', (e) =>
      commitObjects(e.target instanceof ActiveSelection ? e.target.getObjects() : [e.target]),
    );
    canvas.on('text:editing:exited', (e) => commitObjects([e.target]));
    canvas.on('object:moving', (e) => {
      const s = useEditor.getState();
      if (!s.snap) return;
      e.target.set({
        left: Math.round(e.target.left / 10) * 10,
        top: Math.round(e.target.top / 10) * 10,
      });
      const cx = s.project.width / 2 - e.target.getScaledWidth() / 2;
      if (Math.abs(e.target.left - cx) < 8) e.target.left = cx;
    });
    canvas.on('mouse:down', (e) => {
      const s = useEditor.getState();
      if (s.preview) return;
      if (space || s.tool === 'pan' || ('button' in e.e && e.e.button === 1)) {
        pan = true;
        last = { x: e.viewportPoint.x, y: e.viewportPoint.y };
        canvas.selection = false;
        return;
      }
      if (s.tool === 'brush') {
        const point = canvas.getScenePoint(e.e);
        stroke = {
          ...s.brush,
          id: crypto.randomUUID(),
          points: [[point.x, point.y]],
          seed: Math.floor(Math.random() * 2147483647),
        };
        canvas.selection = false;
      }
    });
    canvas.on('mouse:move', (e) => {
      if (pan) {
        const point = e.viewportPoint,
          v = canvas.viewportTransform;
        v[4] += point.x - last.x;
        v[5] += point.y - last.y;
        last = { x: point.x, y: point.y };
        canvas.requestRenderAll();
      } else if (stroke) {
        const point = canvas.getScenePoint(e.e),
          prev = stroke.points.at(-1);
        if (
          prev &&
          Math.hypot(point.x - prev[0], point.y - prev[1]) >=
            Math.max(1, (stroke.size * stroke.spacing) / 100) &&
          stroke.points.length < 2000
        ) {
          stroke.points.push([point.x, point.y]);
          paintOverlay();
        }
      }
    });
    canvas.on('mouse:up', () => {
      if (pan) {
        pan = false;
        canvas.setViewportTransform(canvas.viewportTransform);
        canvas.selection = useEditor.getState().tool === 'select';
      }
      if (stroke) {
        const done = stroke;
        stroke = undefined;
        useEditor.getState().change('Damage painted', (p) => p.strokes.push(done));
        paintOverlay();
      }
    });
    canvas.on('mouse:wheel', (e) => {
      e.e.preventDefault();
      e.e.stopPropagation();
      const z = Math.max(0.08, Math.min(4, canvas.getZoom() * Math.pow(0.999, e.e.deltaY)));
      canvas.zoomToPoint(e.viewportPoint, z);
      useEditor.setState({ zoom: z });
    });
    const keydown = (e: KeyboardEvent) => {
      if (
        typing(e.target) ||
        canvas.getActiveObjects().some((o) => 'isEditing' in o && o.isEditing)
      )
        return;
      const s = useEditor.getState(),
        mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') {
        space = true;
        e.preventDefault();
        return;
      }
      if (mod && ['z', 'c', 'v', 'd', 'g'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        switch (e.key.toLowerCase()) {
          case 'z':
            e.shiftKey ? s.redo() : s.undo();
            break;
          case 'c':
            clipboard = s.selection
              .map((id) => findLayer(s.project.layers, id))
              .filter((l): l is Layer => !!l)
              .map(cloneLayer);
            break;
          case 'v': {
            const clones = clipboard.map((l) => ({
              ...cloneLayer(l),
              x: l.x + 24,
              y: l.y + 24,
              locked: false,
            }));
            s.change('Layers pasted', (p) => p.layers.push(...clones));
            s.select(clones.map((l) => l.id));
            break;
          }
          case 'd':
            s.duplicate();
            break;
          case 'g':
            e.shiftKey ? s.ungroup() : s.group();
            break;
        }
        return;
      }
      if (s.preview) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.remove();
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        s.change(
          'Layers nudged',
          (p) => {
            for (const id of s.selection) {
              const l = findLayer(p.layers, id);
              if (!l || l.locked) continue;
              if (e.key === 'ArrowLeft') l.x -= d;
              if (e.key === 'ArrowRight') l.x += d;
              if (e.key === 'ArrowUp') l.y -= d;
              if (e.key === 'ArrowDown') l.y += d;
            }
          },
          'nudge',
        );
      }
      if (e.key === 'Escape') {
        canvas.discardActiveObject();
        s.select([]);
        useEditor.setState({ tool: 'select', preview: false });
      }
      if (e.key.toLowerCase() === 'v') useEditor.setState({ tool: 'select' });
      if (e.key.toLowerCase() === 'b') useEditor.setState({ tool: 'brush' });
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') space = false;
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      disposed = true;
      revision++;
      clearTimeout(renderTimer);
      unsub();
      resize.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      void canvas.dispose();
      canvas.wrapperEl.remove();
    };
  }, [ready]);
  async function drop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      const asset = await importAsset(file);
      const s = useEditor.getState();
      s.change('Asset uploaded', (p) => p.assets.push(asset));
      s.add(
        createLayer(asset.mime === 'image/svg+xml' ? 'svg' : 'image', {
          name: asset.name,
          assetId: asset.id,
          width: Math.min(600, asset.width),
          height: (Math.min(600, asset.width) * asset.height) / asset.width,
        }),
      );
    } catch (error) {
      useEditor.setState({ error: error instanceof Error ? error.message : 'Upload failed' });
    }
  }
  return (
    <div
      className="workspace"
      ref={host}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void drop(e)}
      aria-label="Artwork workspace"
    >
      <canvas className="guides-overlay" ref={overlay} aria-hidden="true" />
      <div className="workspace-note">SPACE + DRAG TO PAN · SCROLL TO ZOOM · B TO PAINT</div>
    </div>
  );
}
