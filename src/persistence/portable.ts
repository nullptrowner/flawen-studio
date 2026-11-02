import { projectSchema, type Project } from '../types/project';
/** v1 is the first portable format. Unknown versions fail instead of losing newer fields. */
export function parseProject(text: string): Project {
  if (text.length > 24_000_000) throw new Error('Project exceeds the 24 MB portable limit.');
  const raw: unknown = JSON.parse(text);
  let count = 0;
  function guard(value: unknown, depth: number) {
    if (depth > 32) throw new Error('Project nesting is too deep.');
    if (++count > 150000) throw new Error('Project is too complex.');
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) guard(child, depth + 1);
  }
  guard(raw, 0);
  const p = projectSchema.parse(raw);
  validateProjectLimits(p);
  const ids = new Set<string>();
  function layers(items: Project['layers']) {
    for (const l of items) {
      if (ids.has(l.id)) throw new Error('Duplicate layer ID.');
      ids.add(l.id);
      layers(l.children);
    }
  }
  layers(p.layers);
  if (ids.size > 200) throw new Error('Maximum 200 layers including group children.');
  const assets = new Set(p.assets.map((a) => a.id));
  if (assets.size !== p.assets.length) throw new Error('Duplicate asset ID.');
  for (const asset of p.assets) {
    if (!asset.data.startsWith(`data:${asset.mime};base64,`))
      throw new Error('Only embedded assets are supported.');
  }
  function references(items: Project['layers']) {
    for (const l of items) {
      if (l.assetId && !assets.has(l.assetId)) throw new Error('Missing embedded asset.');
      if (l.clipId && (!ids.has(l.clipId) || l.clipId === l.id))
        throw new Error('Invalid clip target.');
      references(l.children);
    }
  }
  references(p.layers);
  return p;
}
export function projectJson(project: Project) {
  return JSON.stringify(project, null, 2);
}

export function validateProjectLimits(project: Project) {
  let count = 0;
  function visit(layers: Project['layers'], depth: number) {
    if (depth > 8) throw new Error('Maximum 8 levels of grouped layers.');
    for (const layer of layers) {
      if (++count > 200) throw new Error('Maximum 200 layers including group children.');
      if (layer.children.length) visit(layer.children, depth + 1);
    }
  }
  visit(project.layers, 0);
  if (project.assets.reduce((sum, asset) => sum + asset.data.length, 0) > 20_000_000)
    throw new Error('Embedded assets exceed the 20 MB project budget.');
  if (project.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) > 30000)
    throw new Error(
      'Maximum 30,000 painted points per project. Remove older strokes before continuing.',
    );
}
