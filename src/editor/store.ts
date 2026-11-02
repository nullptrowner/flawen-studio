import { create } from 'zustand';
import { groupLayers, ungroupLayer } from './groups';
import { validateProjectLimits } from '../persistence/portable';
import {
  createProject,
  projectSchema,
  type Project,
  type Layer,
  type BrushStroke,
} from '../types/project';
export function findLayer(layers: Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    const child = findLayer(layer.children, id);
    if (child) return child;
  }
  return undefined;
}
export function cloneLayer(layer: Layer): Layer {
  return {
    ...structuredClone(layer),
    id: crypto.randomUUID(),
    children: layer.children.map(cloneLayer),
  };
}
function removeLayers(layers: Layer[], ids: string[]): Layer[] {
  return layers
    .filter((l) => !ids.includes(l.id))
    .map((l) => ({ ...l, children: removeLayers(l.children, ids) }));
}
export type Tool = 'select' | 'pan' | 'brush';
interface EditorState {
  mobilePanel: 'library' | 'inspector' | null;
  project: Project;
  selection: string[];
  past: Project[];
  future: Project[];
  revision: number;
  savedRevision: number;
  tool: Tool;
  zoom: number;
  fitRequest: number;
  guides: boolean;
  snap: boolean;
  preview: boolean;
  theme: 'dark' | 'neutral';
  status: string;
  error: string;
  ready: boolean;
  brush: Omit<BrushStroke, 'id' | 'points' | 'seed'>;
  open: (project: Project, saved?: boolean) => void;
  change: (label: string, recipe: (draft: Project) => void, merge?: string) => void;
  patchLayer: (id: string, patch: Partial<Layer>, merge?: string) => void;
  select: (ids: string[]) => void;
  add: (layer: Layer) => void;
  remove: () => void;
  duplicate: () => void;
  reorder: (id: string, index: number) => void;
  group: () => void;
  ungroup: () => void;
  undo: () => void;
  redo: () => void;
}
let lastMerge = '';
let lastTime = 0;
export const useEditor = create<EditorState>((set, get) => ({
  mobilePanel: null,
  project: createProject(),
  selection: [],
  past: [],
  future: [],
  revision: 0,
  savedRevision: 0,
  tool: 'select',
  zoom: 1,
  fitRequest: 0,
  guides: true,
  snap: true,
  preview: false,
  theme: 'dark',
  status: 'Opening local workspace…',
  error: '',
  ready: false,
  brush: { mode: 'Add wear', size: 72, hardness: 55, strength: 35, spacing: 12, opacity: 1 },
  open: (project, saved = false) => {
    lastMerge = '';
    set((s) => ({
      project: structuredClone(project),
      selection: [],
      past: [],
      future: [],
      revision: s.revision + 1,
      savedRevision: saved ? s.revision + 1 : s.savedRevision,
      fitRequest: s.fitRequest + 1,
      status: saved ? 'Saved locally' : 'Unsaved changes',
      error: '',
    }));
  },
  change: (label, recipe, merge) => {
    const s = get();
    const draft = structuredClone(s.project);
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
    const valid = projectSchema.safeParse(draft);
    if (!valid.success) {
      set({ error: valid.error.issues[0]?.message ?? 'Invalid project change.' });
      return;
    }
    try {
      validateProjectLimits(draft);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Project exceeds limits.' });
      return;
    }
    if (draft.layers.length > 200) {
      set({ error: 'Maximum 200 layers per project.' });
      return;
    }
    if (draft.strokes.length > 250) {
      set({ error: 'Maximum 250 brush strokes. Remove old strokes before continuing.' });
      return;
    }
    const combined = !!merge && lastMerge === merge && Date.now() - lastTime < 650;
    lastMerge = merge ?? '';
    lastTime = Date.now();
    set({
      project: draft,
      past: combined ? s.past : [...s.past, s.project].slice(-30),
      future: [],
      revision: s.revision + 1,
      status: label,
      error: '',
    });
  },
  patchLayer: (id, patch, merge) =>
    get().change(
      'Unsaved changes',
      (p) => {
        const l = findLayer(p.layers, id);
        if (!l) return;
        if (l.kind === 'group' && (patch.width || patch.height)) {
          const sx = (patch.width ?? l.width) / l.width,
            sy = (patch.height ?? l.height) / l.height;
          function scale(children: Layer[]) {
            for (const c of children) {
              c.x *= sx;
              c.y *= sy;
              c.width *= sx;
              c.height *= sy;
              c.fontSize *= Math.min(sx, sy);
              scale(c.children);
            }
          }
          scale(l.children);
        }
        Object.assign(l, patch);
      },
      merge,
    ),
  select: (selection) => set({ selection }),
  add: (layer) => {
    get().change('Layer added', (p) => {
      p.layers.push(layer);
    });
    set({ selection: [layer.id], tool: 'select' });
  },
  remove: () => {
    const ids = get().selection.filter((id) => !findLayer(get().project.layers, id)?.locked);
    get().change('Layers removed', (p) => {
      p.layers = removeLayers(p.layers, ids);
      for (const l of p.layers) if (l.clipId && ids.includes(l.clipId)) l.clipId = null;
    });
    set({ selection: [] });
  },
  duplicate: () => {
    const layers = get()
      .selection.map((id) => findLayer(get().project.layers, id))
      .filter((l): l is Layer => !!l)
      .map((l) => ({
        ...cloneLayer(l),
        x: l.x + 24,
        y: l.y + 24,
        name: l.name + ' copy',
        locked: false,
      }));
    get().change('Layers duplicated', (p) => {
      p.layers.push(...layers);
    });
    set({ selection: layers.map((l) => l.id) });
  },
  reorder: (id, index) =>
    get().change('Layer order changed', (p) => {
      const old = p.layers.findIndex((l) => l.id === id);
      if (old < 0) return;
      const [layer] = p.layers.splice(old, 1);
      p.layers.splice(Math.max(0, Math.min(index, p.layers.length)), 0, layer);
    }),
  group: () => {
    const selected = get().project.layers.filter(
      (l) => get().selection.includes(l.id) && !l.locked,
    );
    if (selected.length < 2) return;
    const group = groupLayers(selected);
    get().change('Layers grouped', (p) => {
      const index = p.layers.findIndex((l) => l.id === selected[0].id);
      p.layers = p.layers.filter((l) => !selected.some((s) => s.id === l.id));
      p.layers.splice(index, 0, group);
    });
    set({ selection: [group.id] });
  },
  ungroup: () => {
    const ids: string[] = [];
    get().change('Group released', (p) => {
      p.layers = p.layers.flatMap((l) => {
        if (l.kind !== 'group' || !get().selection.includes(l.id) || l.locked) return [l];
        const children = ungroupLayer(l);
        ids.push(...children.map((c) => c.id));
        return children;
      });
    });
    set({ selection: ids });
  },
  undo: () => {
    const s = get(),
      p = s.past.at(-1);
    if (!p) return;
    lastMerge = '';
    set({
      project: p,
      past: s.past.slice(0, -1),
      future: [s.project, ...s.future],
      selection: [],
      revision: s.revision + 1,
      status: 'Undone',
    });
  },
  redo: () => {
    const s = get(),
      p = s.future[0];
    if (!p) return;
    lastMerge = '';
    set({
      project: p,
      past: [...s.past, s.project],
      future: s.future.slice(1),
      selection: [],
      revision: s.revision + 1,
      status: 'Redone',
    });
  },
}));
