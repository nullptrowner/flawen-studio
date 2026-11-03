import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const out = new URL('../pictures/twitter/', import.meta.url);
await mkdir(new URL('projects/', out), { recursive: true });
const base = JSON.parse(
  await readFile(new URL('../pictures/bots/projects/sessions-home.json', import.meta.url), 'utf8'),
);
const avatarBase = JSON.parse(
  await readFile(
    new URL('../pictures/bots/projects/avatar-sessions.json', import.meta.url),
    'utf8',
  ),
);
const textBase = base.layers.find((l) => l.kind === 'text');
const shapeBase = base.layers.find((l) => l.kind === 'shape');
function text(name, value, x, y, width, size, extra = {}) {
  return {
    ...textBase,
    id: randomUUID(),
    name,
    kind: 'text',
    text: value,
    x,
    y,
    width,
    height: size * 2.5,
    fontFamily: 'Inter',
    fontSize: size,
    fontWeight: 700,
    lineHeight: 1.02,
    letterSpacing: -35,
    color: '#f5f5f5',
    align: 'left',
    strokeWidth: 0,
    ...extra,
  };
}
const banner = {
  ...base,
  id: randomUUID(),
  name: 'FLAWEN / X header',
  width: 1500,
  height: 500,
  strokes: [],
  assets: [],
  background: {
    ...avatarBase.background,
    wear: 14,
    grain: 9,
    dust: 3,
    scratches: 12,
    edge: 12,
    erosion: 5,
    seed: 43117,
  },
  layers: [
    text('Brand identifier', 'FLAWEN / INDEPENDENT MEDIA BUYING', 105, 102, 850, 15, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      letterSpacing: 35,
    }),
    text('Wordmark', 'FLAWEN', 92, 163, 850, 166, { fontWeight: 850, letterSpacing: -65 }),
    {
      ...shapeBase,
      id: randomUUID(),
      name: 'Vertical divider',
      kind: 'shape',
      shape: 'rectangle',
      x: 947,
      y: 170,
      width: 1,
      height: 151,
      color: '#777777',
      strokeWidth: 0,
    },
    text('Manifesto', 'NOTHING STAYS\nFLAWLESS.', 1000, 197, 430, 39, {
      fontWeight: 650,
      letterSpacing: -30,
    }),
    text('Website', 'FLAWEN.COM', 1003, 332, 300, 15, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      letterSpacing: 100,
    }),
    text('Signature', 'PRECISE EXECUTION. CONSTANT EVOLUTION.', 405, 384, 800, 13, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      color: '#bdbdbd',
      letterSpacing: 50,
    }),
  ],
};
const symbol = avatarBase.layers.find((l) => l.kind === 'logo');
const avatar = {
  ...avatarBase,
  id: randomUUID(),
  name: 'FLAWEN / X avatar',
  width: 400,
  height: 400,
  background: {
    ...avatarBase.background,
    wear: 8,
    grain: 5,
    scratches: 5,
    edge: 5,
    dust: 0,
    erosion: 0,
    seed: 43118,
  },
  layers: [
    {
      ...symbol,
      id: randomUUID(),
      x: 88,
      y: 88,
      width: 224,
      height: 224,
      distress: 13,
      strokeWidth: 0,
    },
  ],
  strokes: [],
  assets: [],
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:5180');
  await page.getByText('Saved locally', { exact: true }).waitFor();
  for (const [key, project] of [
    ['flawen-x-banner', banner],
    ['flawen-x-avatar', avatar],
  ]) {
    await page.getByTitle('Open projects', { exact: true }).click();
    await page
      .locator('input[type=file][accept=".json"]')
      .setInputFiles({
        name: key + '.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(project)),
      });
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    await page.getByText('Saved locally', { exact: true }).waitFor();
    const json = page.waitForEvent('download');
    await page.getByTitle('Export editable JSON').click();
    await (await json).saveAs(new URL(`projects/${key}.json`, out).pathname);
    await page.getByRole('button', { name: 'Export ↗', exact: true }).click();
    await page.getByLabel('Format', { exact: true }).selectOption('png');
    const png = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download artwork', exact: true }).click();
    await (await png).saveAs(new URL(key + '.png', out).pathname);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    const bytes = await readFile(new URL(key + '.png', out));
    if (bytes.readUInt32BE(16) !== project.width || bytes.readUInt32BE(20) !== project.height)
      throw Error('Export dimensions mismatch');
    console.log(key, project.width, project.height);
  }
  const header = (await readFile(new URL('flawen-x-banner.png', out))).toString('base64'),
    av = (await readFile(new URL('flawen-x-avatar.png', out))).toString('base64');
  const preview = await browser.newPage({
    viewport: { width: 1000, height: 560 },
    deviceScaleFactor: 1,
  });
  await preview.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font-family:Arial}main{width:900px;margin:20px auto;border:1px solid #333}.header{width:100%;display:block}.avatar{width:150px;height:150px;border-radius:50%;border:6px solid black;position:absolute;top:-75px;left:22px}.info{position:relative;padding:90px 25px 25px}h1{font-size:25px;margin:0 0 10px}p{font-size:16px;color:#bbb;margin:0}</style><main><img class="header" src="data:image/png;base64,${header}"><div class="info"><img class="avatar" src="data:image/png;base64,${av}"><h1>FLAWEN</h1><p>Independent media buying. Nothing stays flawless.</p></div></main>`,
  );
  await preview.screenshot({ path: new URL('profile-preview.png', out).pathname });
  await writeFile(
    new URL('manifest.json', out),
    JSON.stringify(
      {
        createdIn: 'FLAWEN STUDIO import and UI export',
        images: [
          { file: 'flawen-x-banner.png', width: 1500, height: 500 },
          { file: 'flawen-x-avatar.png', width: 400, height: 400 },
        ],
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
