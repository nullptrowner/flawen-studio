import { z } from 'zod';
import { assetSchema, layerSchema, type Layer, type Project } from '../types/project';

export const libraryEntrySchema = z.object({
  layer: layerSchema,
  assets: z.array(assetSchema).max(50),
});
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

export function createLibraryEntry(layer: Layer, project: Project): LibraryEntry {
  const ids = new Set<string>();
  const visit = (item: Layer) => {
    if (item.assetId) ids.add(item.assetId);
    item.children.forEach(visit);
  };
  visit(layer);
  return {
    layer: structuredClone(layer),
    assets: project.assets.filter((asset) => ids.has(asset.id)),
  };
}

export function parseLibraryEntry(value: unknown): LibraryEntry | null {
  const current = libraryEntrySchema.safeParse(value);
  if (current.success) return current.data;
  // Early local libraries stored built-in layers without an asset envelope.
  const legacy = layerSchema.safeParse(value);
  return legacy.success && !legacy.data.assetId ? { layer: legacy.data, assets: [] } : null;
}
