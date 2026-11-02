import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createProject, createLayer, type Project } from '../src/types/project';
async function load(page: Page, p: Project) {
  await page.getByTitle('Open projects').click();
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function exportFile(
  page: Page,
  format = 'png',
  width = 1280,
  height = 720,
  layout = 'fit',
  transparent = false,
) {
  await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption(format);
  await page.getByLabel('Output width', { exact: true }).fill(String(width));
  await page.getByLabel('Output height', { exact: true }).fill(String(height));
  await page
    .getByRole('combobox', { name: 'Aspect ratio behavior', exact: true })
    .selectOption(layout);
  if (transparent)
    await page.getByRole('checkbox', { name: 'Transparent background / foreground only' }).check();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download artwork' }).click();
  const file = await pending,
    path = await file.path();
  if (!path) throw Error('No export');
  const bytes = await readFile(path);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  return bytes;
}
async function difference(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([first, second]) => {
      const decode = async (data: string) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + data;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const ctx = c.getContext('2d');
        if (!ctx) throw Error('No context');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const x = await decode(first),
        y = await decode(second);
      let delta = 0;
      for (let i = 0; i < x.length; i++) delta += Math.abs(x[i] - y[i]);
      return delta / x.length;
    },
    [a.toString('base64'), b.toString('base64')],
  );
}
test('group and ungroup keep rotated artwork in place; guides never enter PNG', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const a = createLayer('shape', {
      name: 'A',
      x: 250,
      y: 220,
      width: 140,
      height: 90,
      rotation: 27,
    }),
    b = createLayer('shape', {
      name: 'B',
      x: 520,
      y: 300,
      width: 200,
      height: 160,
      shape: 'circle',
      color: '#777777',
    });
  await load(page, createProject('Group fidelity', { layers: [a, b] }));
  const before = await exportFile(page);
  await page.getByTitle('Safe area and rulers').click();
  const noGuides = await exportFile(page);
  expect(await difference(page, before, noGuides)).toBe(0);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.locator('.layer-name').filter({ hasText: 'A' }).click();
  await page
    .locator('.layer-name')
    .filter({ hasText: 'B' })
    .click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group', exact: true }).click();
  const grouped = await exportFile(page);
  expect(await difference(page, before, grouped)).toBeLessThan(0.15);
  await page.getByTitle('Flip horizontally').click();
  await page.getByLabel('Rotation', { exact: true }).fill('37');
  const mirrored = await exportFile(page);
  await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
  const restored = await exportFile(page);
  expect(await difference(page, mirrored, restored)).toBeLessThan(0.15);
});
test('SVG embeds fonts and effects, WebP and portrait crop have exact output dimensions', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await load(
    page,
    createProject('Formats', {
      layers: [
        createLayer('text', { text: 'НОВОСТИ FLAWEN', x: 50, y: 60, width: 1150, fontSize: 80 }),
        createLayer('crack', { width: 900, height: 300, x: 50, y: 300 }),
      ],
    }),
  );
  const svg = await exportFile(page, 'svg', 1080, 1920);
  expect(svg.toString()).toContain('data:font/woff2;base64');
  expect(svg.toString()).toContain('data:image/svg+xml;base64');
  expect(svg.toString()).not.toContain('upper-canvas');
  const dimensions = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + data;
    await img.decode();
    return [img.width, img.height];
  }, svg.toString('base64'));
  expect(dimensions).toEqual([1080, 1920]);
  const webp = await exportFile(page, 'webp', 512, 512);
  const size = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/webp;base64,' + data;
    await img.decode();
    return [img.width, img.height];
  }, webp.toString('base64'));
  expect(size).toEqual([512, 512]);
  const png = await exportFile(page, 'png', 1080, 1920, 'crop');
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  const transparent = await exportFile(page, 'png', 1280, 720, 'fit', true);
  const alpha = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = new OffscreenCanvas(1280, 720);
    const ctx = c.getContext('2d');
    if (!ctx) throw Error('No context');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(1279, 719, 1, 1).data[3];
  }, transparent.toString('base64'));
  expect(alpha).toBe(0);
  // Vite reloads pages when an SVG in its root changes; write evidence after UI checks.
  await writeFile('docs/media/export-sample.svg', svg);
});
test('mobile panels and Cyrillic presets remain usable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.getByLabel('Template language').selectOption('ru');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByRole('button', { name: 'Use News', exact: true }).click();
  await page.getByRole('button', { name: 'Close library' }).click();
  await page.getByTitle('Toggle side panels').click();
  await expect(page.getByRole('heading', { name: 'Surface properties' })).toBeVisible();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/media/studio-mobile.png' });
});
