import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { builtInTemplates } from '../src/templates';
import JSZip from 'jszip';
async function start(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await expect(page.locator('.upper-canvas')).toBeVisible();
}
async function jsonDownload(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.getByTitle('Export editable JSON').click();
  const download = await waiting;
  const path = await download.path();
  if (!path) throw new Error('No download path');
  return readFile(path, 'utf8');
}
async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download artwork', exact: true }).click();
  const file = await download;
  const path = await file.path();
  if (!path) throw new Error('No image file');
  const bytes = await readFile(path);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  return bytes;
}
test('NEWS workflow: Russian text, material, two cracks, logo transform, brush, save/reopen and exact PNG', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.locator('.layer-name').filter({ hasText: 'Headline' }).first().click();
  await page.getByLabel('Text content', { exact: true }).fill('НОВОСТИ\nКОМАНДЫ');
  await page.getByLabel('Font size', { exact: true }).fill('96');
  await page.getByLabel('X', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Cracks', exact: true }).click();
  await page.getByRole('button', { name: /01 Hairline fracture/ }).click();
  await page.getByLabel('Seed', { exact: true }).fill('994');
  await page.getByRole('button', { name: /02 Porcelain crack/ }).click();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.locator('.layer-name').filter({ hasText: 'Logo' }).first().click();
  await page.getByLabel('X', { exact: true }).fill('90');
  await page.getByLabel('Logo distress', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Backgrounds', exact: true }).click();
  await page.getByRole('button', { name: 'Edit surface properties ↗' }).click();
  await page.getByLabel('Material', { exact: true }).selectOption('Matte plaster');
  await page.getByRole('button', { name: 'WORN', exact: true }).click();
  await page.getByTitle('Damage brush · B').click();
  const box = await page.locator('.upper-canvas').boundingBox();
  if (!box) throw new Error('Missing canvas');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65, { steps: 25 });
  await page.mouse.up();
  await expect(page.getByText('Editable strokes · 1')).toBeVisible();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const saved = JSON.parse(await jsonDownload(page));
  expect(saved.layers.some((l: { text: string }) => l.text === 'НОВОСТИ\nКОМАНДЫ')).toBe(true);
  expect(saved.layers.filter((l: { kind: string }) => l.kind === 'crack')).toHaveLength(2);
  expect(saved.strokes).toHaveLength(1);
  expect(saved.background.material).toBe('Matte plaster');
  await page.reload();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const reopened = JSON.parse(await jsonDownload(page));
  expect(reopened.layers).toEqual(saved.layers);
  expect(reopened.strokes).toEqual(saved.strokes);
  const png = await exportPng(page);
  expect(png.readUInt32BE(16)).toBe(1280);
  expect(png.readUInt32BE(20)).toBe(720);
  await mkdir('docs/media', { recursive: true });
  await writeFile('docs/media/news-edited.png', png);
  await page.screenshot({ path: 'docs/media/studio-workflow.png' });
  expect(errors).toEqual([]);
});
test('layer keyboard commands, grouping, selection, ordering and undo preserve the scene', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  const headline = page.locator('.layer-name').filter({ hasText: 'Headline' }).first();
  await headline.click();
  await page.getByLabel('Text content', { exact: true }).fill('DO NOT DELETE WHILE TYPING');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue(
    'DO NOT DELETE WHILE TYPING',
  );
  await headline.click();
  const before = JSON.parse(await jsonDownload(page));
  await page.keyboard.press('ControlOrMeta+d');
  const after = JSON.parse(await jsonDownload(page));
  expect(after.layers.length).toBe(before.layers.length + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(JSON.parse(await jsonDownload(page)).layers.length).toBe(before.layers.length);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('.layer-name').filter({ hasText: 'Headline copy' }).click();
  await page.keyboard.press('Delete');
  expect(JSON.parse(await jsonDownload(page)).layers.length).toBe(before.layers.length);
  await page.locator('.layer-name').filter({ hasText: 'Headline' }).first().click();
  await page
    .locator('.layer-name')
    .filter({ hasText: 'Subtitle' })
    .first()
    .click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group', exact: true }).click();
  expect(
    JSON.parse(await jsonDownload(page)).layers.some((l: { kind: string }) => l.kind === 'group'),
  ).toBe(true);
  await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
  expect(
    JSON.parse(await jsonDownload(page)).layers.some((l: { kind: string }) => l.kind === 'group'),
  ).toBe(false);
});
test('SVG uploads are sanitized, projects are portable and unsafe imports are rejected', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page
    .locator('.library input[type=file]')
    .setInputFiles({
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    });
  await expect(page.getByRole('alert')).toContainText('Unsupported SVG');
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await page
    .locator('.library input[type=file]')
    .setInputFiles({
      name: 'master.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="5" y="5" width="90" height="90" fill="#111"/><path d="M20 20H80V35H35V50H65V65H35V80H20Z" fill="white"/></svg>',
      ),
    });
  const json = await jsonDownload(page);
  expect(JSON.parse(json).assets).toHaveLength(1);
  const first = await exportPng(page);
  await page.getByTitle('Open projects').click();
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({
      name: 'roundtrip.json',
      mimeType: 'application/json',
      buffer: Buffer.from(json),
    });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const second = await exportPng(page);
  expect(second.equals(first)).toBe(true);
});
test('all 22 presets export real artwork with correct dimensions', async ({ page }) => {
  test.setTimeout(180000);
  await start(page);
  await mkdir('docs/media/templates', { recursive: true });
  for (const t of builtInTemplates) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page.getByRole('button', { name: `Use ${t.name}`, exact: true }).click();
    await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
    const image = await exportPng(page);
    expect(image.readUInt32BE(16)).toBe(t.project.width);
    expect(image.readUInt32BE(20)).toBe(t.project.height);
    await writeFile(`docs/media/templates/${t.id}.png`, image);
  }
});
test('CSV variations export a valid ZIP of full-resolution PNGs', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Batch offer generator ↗' }).click();
  await page
    .getByLabel('Bulk data', { exact: true })
    .fill('title,subtitle\nOFFER #01,First\nOFFER #02,Second');
  await page.getByRole('button', { name: 'Generate variations' }).click();
  await expect(page.locator('dialog').getByRole('status')).toContainText('2 editable');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all as ZIP' }).click();
  const file = await pending,
    path = await file.path();
  if (!path) throw new Error('No ZIP');
  const zip = await JSZip.loadAsync(await readFile(path));
  const files = Object.values(zip.files).filter((f) => !f.dir);
  expect(files).toHaveLength(2);
  for (const f of files) {
    const image = await f.async('nodebuffer');
    expect(image.readUInt32BE(16)).toBe(1280);
    expect(image.readUInt32BE(20)).toBe(720);
  }
});
