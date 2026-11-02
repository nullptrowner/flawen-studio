import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createLayer, createProject, type Template } from '../src/types/project';
import {
  deleteProject,
  deleteTemplate,
  listLibrary,
  listProjects,
  listTemplates,
  loadProject,
  preference,
  saveLibrary,
  savePreference,
  saveProject,
  saveTemplate,
} from '../src/persistence/database';
import { parseProject, projectJson } from '../src/persistence/portable';

function composition() {
  const assetId = crypto.randomUUID();
  return createProject('Material study', {
    layers: [
      createLayer('image', { assetId }),
      createLayer('logo', { logoVariant: 'symbol', distress: 38 }),
    ],
    assets: [
      {
        id: assetId,
        name: 'Embedded swatch',
        mime: 'image/svg+xml',
        data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=',
        width: 1,
        height: 1,
      },
    ],
    strokes: [
      {
        id: crypto.randomUUID(),
        mode: 'Add wear',
        points: [
          [20, 30],
          [60, 70],
        ],
        size: 32,
        hardness: 75,
        strength: 61,
        spacing: 18,
        opacity: 0.7,
        seed: 908,
      },
    ],
  });
}

describe('IndexedDB project persistence', () => {
  it('round-trips embedded assets, structured brush strokes and editable layers', async () => {
    const project = composition();
    await saveProject(project);
    const loaded = await loadProject(project.id);
    expect(loaded).toEqual(project);
    expect(parseProject(projectJson(loaded!))).toEqual(project);
    // A returned object must not be a live reference into storage.
    loaded!.strokes[0].points[0][0] = 999;
    loaded!.assets[0].name = 'Unsaved mutation';
    expect(await loadProject(project.id)).toEqual(project);
    await deleteProject(project.id);
    expect(await loadProject(project.id)).toBeUndefined();
  });

  it('keeps a saved duplicate independent of the original project', async () => {
    const original = composition();
    await saveProject(original);
    const duplicate = parseProject(projectJson(original));
    duplicate.id = crypto.randomUUID();
    duplicate.name = 'Independent copy';
    duplicate.layers[1].distress = 90;
    duplicate.strokes[0].points.push([120, 130]);
    duplicate.assets[0].name = 'Copy swatch';
    await saveProject(duplicate);
    expect(await loadProject(original.id)).toEqual(original);
    expect(await loadProject(duplicate.id)).toEqual(duplicate);
    await deleteProject(original.id);
    expect(await loadProject(duplicate.id)).toEqual(duplicate);
    await deleteProject(duplicate.id);
  });

  it('updates existing records and lists projects with newest edits first', async () => {
    const older = createProject('Older', { updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = createProject('Newer', { updatedAt: '2026-02-01T00:00:00.000Z' });
    await saveProject(older);
    await saveProject(newer);
    await saveProject({ ...older, name: 'Updated', updatedAt: '2026-03-01T00:00:00.000Z' });
    const records = (await listProjects()).filter((p) => p.id === older.id || p.id === newer.id);
    expect(records.map((p) => p.name)).toEqual(['Updated', 'Newer']);
    await deleteProject(older.id);
    await deleteProject(newer.id);
  });
});

describe('IndexedDB reusable studio content', () => {
  it('creates, updates and deletes a custom template without changing its source', async () => {
    const project = composition();
    const template: Template = {
      id: crypto.randomUUID(),
      name: 'Custom layout',
      category: 'Custom',
      description: 'Your saved composition',
      project,
      custom: true,
    };
    await saveTemplate(template);
    expect((await listTemplates()).find((t) => t.id === template.id)).toEqual(template);
    const changed = {
      ...template,
      name: 'Revised layout',
      project: parseProject(projectJson(project)),
    };
    changed.project.layers[1].color = '#555555';
    await saveTemplate(changed);
    const matches = (await listTemplates()).filter((t) => t.id === template.id);
    expect(matches).toEqual([changed]);
    expect(project.layers[1].color).toBe('#111111');
    await deleteTemplate(template.id);
    expect((await listTemplates()).some((t) => t.id === template.id)).toBe(false);
  });

  it('persists saved logo, text style and settings as isolated structured values', async () => {
    const logoId = crypto.randomUUID(),
      styleId = crypto.randomUUID(),
      settingId = crypto.randomUUID();
    const logo = createLayer('logo', { logoVariant: 'vertical', distress: 55 });
    const style = {
      fontFamily: 'Space Grotesk',
      fontWeight: 700,
      fontSize: 48,
      letterSpacing: -2,
      color: '#222222',
    };
    const settings = { theme: 'dark', rulers: true, recentSizes: [{ width: 1280, height: 720 }] };
    await saveLibrary(logoId, logo);
    await saveLibrary(styleId, style);
    await savePreference(settingId, settings);
    const saved = await listLibrary();
    expect(saved.find((item) => item.id === logoId)?.value).toEqual(logo);
    expect(saved.find((item) => item.id === styleId)?.value).toEqual(style);
    expect(await preference(settingId)).toEqual(settings);
    style.fontSize = 80;
    settings.recentSizes[0].width = 500;
    expect((await listLibrary()).find((item) => item.id === styleId)?.value).toMatchObject({
      fontSize: 48,
    });
    expect(await preference(settingId)).toMatchObject({
      recentSizes: [{ width: 1280, height: 720 }],
    });
    await saveLibrary(styleId, style);
    expect((await listLibrary()).filter((item) => item.id === styleId)).toEqual([
      { id: styleId, value: style },
    ]);
    await savePreference(settingId, { theme: 'light' });
    expect(await preference(settingId)).toEqual({ theme: 'light' });
    expect(await preference(crypto.randomUUID())).toBeUndefined();
  });
});
