import { z } from 'zod';
export const gray = z.string().regex(/^#([0-9a-fA-F]{2})\1\1$/);
export const layerKinds = [
  'text',
  'logo',
  'svg',
  'shape',
  'image',
  'crack',
  'scratch',
  'grain',
  'erosion',
  'texture',
  'frame',
  'line',
  'group',
] as const;
export const materials = [
  'White paper',
  'Porcelain',
  'Matte plaster',
  'Rough industrial',
  'Black material',
  'Distressed print',
] as const;
export const brushModes = [
  'Scratch',
  'Crack',
  'Erase material',
  'Add dust',
  'Add wear',
  'Restore clean surface',
  'Remove damage',
] as const;
export const crackPresets = [
  'Hairline fracture',
  'Porcelain crack',
  'Branching crack',
  'Impact fracture',
  'Surface split',
  'Edge fracture',
  'Fine spiderweb crack',
  'Structural rupture',
] as const;
export const fonts = ['Inter', 'Roboto Flex', 'Space Grotesk', 'IBM Plex Mono'] as const;
const finite = z.number().finite();
const amount = finite.min(0).max(100);
export const effectSchema = z.object({
  seed: z.number().int().min(0).max(2147483647),
  preset: z.enum(crackPresets),
  length: finite.min(10).max(8192),
  thickness: finite.min(0.1).max(40),
  branching: amount,
  branchCount: z.number().int().min(0).max(40),
  irregularity: amount,
  direction: finite.min(-360).max(360),
  intensity: amount,
});
export type Effect = z.infer<typeof effectSchema>;
export const backgroundSchema = z.object({
  color: gray,
  material: z.enum(materials),
  wear: amount,
  grain: amount,
  cracks: amount,
  scratches: amount,
  erosion: amount,
  edge: amount,
  contrast: amount,
  dust: amount,
  roughness: amount,
  seed: z.number().int().min(0).max(2147483647),
  seeds: z.object({
    cracks: z.number().int(),
    scratches: z.number().int(),
    erosion: z.number().int(),
    grain: z.number().int(),
  }),
  locked: z.array(z.string().max(30)).max(20),
});
export type Background = z.infer<typeof backgroundSchema>;
const baseLayer = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(200),
  kind: z.enum(layerKinds),
  x: finite.min(-16384).max(16384),
  y: finite.min(-16384).max(16384),
  width: finite.min(1).max(16384),
  height: finite.min(1).max(16384),
  rotation: finite.min(-3600).max(3600),
  opacity: finite.min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  color: gray,
  stroke: gray,
  strokeWidth: finite.min(0).max(100),
  shape: z.enum([
    'rectangle',
    'circle',
    'crosshair',
    'grid',
    'corners',
    'dots',
    'registration',
    'fragments',
  ]),
  text: z.string().max(10000),
  fontFamily: z.enum(fonts),
  fontSize: finite.min(4).max(2000),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: finite.min(0.5).max(3),
  letterSpacing: finite.min(-300).max(2000),
  align: z.enum(['left', 'center', 'right', 'justify']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  uppercase: z.boolean(),
  outline: z.boolean(),
  logoVariant: z.enum(['symbol', 'wordmark', 'horizontal', 'vertical', 'full']),
  distress: amount,
  effect: effectSchema,
  assetId: z.string().max(100).nullable(),
  clipId: z.string().max(100).nullable(),
});
export interface Layer extends z.infer<typeof baseLayer> {
  children: Layer[];
}
export const layerSchema: z.ZodType<Layer> = z.lazy(() =>
  baseLayer.extend({ children: z.array(layerSchema).max(100) }),
);
export const strokeSchema = z.object({
  id: z.string(),
  mode: z.enum(brushModes),
  points: z
    .array(z.tuple([finite.min(-16384).max(16384), finite.min(-16384).max(16384)]))
    .min(1)
    .max(5000),
  size: finite.min(1).max(1000),
  hardness: amount,
  strength: amount,
  spacing: finite.min(1).max(100),
  opacity: finite.min(0).max(1),
  seed: z.number().int(),
});
export type BrushStroke = z.infer<typeof strokeSchema>;
export const assetSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  mime: z.enum(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']),
  data: z.string().max(16_000_000),
  width: finite.positive().max(8192),
  height: finite.positive().max(8192),
});
export type Asset = z.infer<typeof assetSchema>;
export const projectSchema = z.object({
  version: z.literal(1),
  id: z.string().max(100),
  name: z.string().min(1).max(200),
  templateId: z.string().max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
  background: backgroundSchema,
  layers: z.array(layerSchema).max(200),
  strokes: z.array(strokeSchema).max(250),
  assets: z.array(assetSchema).max(50),
});
export type Project = z.infer<typeof projectSchema>;
export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  project: Project;
  custom?: boolean;
}
export const defaultBackground: Background = {
  color: '#f5f5f5',
  material: 'White paper',
  wear: 14,
  grain: 12,
  cracks: 0,
  scratches: 8,
  erosion: 4,
  edge: 5,
  contrast: 35,
  dust: 4,
  roughness: 18,
  seed: 418,
  seeds: { cracks: 419, scratches: 420, erosion: 421, grain: 422 },
  locked: [],
};
export function createLayer(kind: Layer['kind'], patch: Partial<Layer> = {}): Layer {
  return layerSchema.parse({
    id: crypto.randomUUID(),
    name: kind.toUpperCase(),
    kind,
    x: 100,
    y: 100,
    width: 400,
    height: 180,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    color: '#111111',
    stroke: '#111111',
    strokeWidth: 2,
    shape: 'rectangle',
    text: 'NOTHING STAYS\nFLAWLESS.',
    fontFamily: 'Inter',
    fontSize: 80,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: -45,
    align: 'left',
    verticalAlign: 'top',
    uppercase: false,
    outline: false,
    logoVariant: 'horizontal',
    distress: 20,
    effect: {
      seed: 418,
      preset: 'Porcelain crack',
      length: 400,
      thickness: 1.6,
      branching: 35,
      branchCount: 8,
      irregularity: 45,
      direction: 0,
      intensity: 65,
    },
    assetId: null,
    clipId: null,
    children: [],
    ...patch,
  });
}
export function createProject(name = 'Untitled artifact', patch: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return projectSchema.parse({
    version: 1,
    id: crypto.randomUUID(),
    name,
    templateId: 'news',
    createdAt: now,
    updatedAt: now,
    width: 1280,
    height: 720,
    background: structuredClone(defaultBackground),
    layers: [],
    strokes: [],
    assets: [],
    ...patch,
  });
}
