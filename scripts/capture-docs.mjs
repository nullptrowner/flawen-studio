import { chromium } from '@playwright/test';
import { readdir, mkdir } from 'node:fs/promises';
const baseURL = process.env.STUDIO_URL ?? 'http://127.0.0.1:5180';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
  recordVideo: { dir: 'docs/media/video', size: { width: 1200, height: 800 } },
});
const page = await context.newPage();
await page.goto(baseURL);
await page.getByText('Saved locally', { exact: true }).waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/media/studio.png' });
for (const state of ['PRISTINE', 'WORN', 'DAMAGED', 'FRACTURED', 'DESTROYED', 'PRISTINE']) {
  await page.getByRole('button', { name: state, exact: true }).click();
  await page.waitForTimeout(1100);
}
const video = page.video();
await context.close();
if (video) await video.saveAs('docs/media/material-demo.webm');
const gallery = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const files = (await readdir('docs/media/templates')).filter((f) => f.endsWith('.png')).sort();
await gallery.goto(baseURL);
await gallery.setContent(
  `<style>*{box-sizing:border-box}body{margin:0;background:#111;color:#eee;font:14px Arial;padding:48px}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:36px}h1{font-size:50px;letter-spacing:-3px;margin:0}header p{font:11px monospace;letter-spacing:2px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}figure{margin:0}img{width:100%;height:180px;object-fit:contain;background:#202020}figcaption{font:11px monospace;letter-spacing:1px;padding:12px 0;color:#aaa;text-transform:uppercase}</style><header><div><p>THE FLAWEN DESIGN SYSTEM</p><h1>22 starting points.<br>Endless consequences.</h1></div><p>ACTUAL EDITOR EXPORTS / 01—22</p></header><div class="grid">${files.map((f, i) => `<figure><img src="${baseURL}/docs/media/templates/${f}"><figcaption>${String(i + 1).padStart(2, '0')} / ${f.slice(0, -4).replaceAll('-', ' ')}</figcaption></figure>`).join('')}</div>`,
);
await gallery
  .locator('img')
  .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
await gallery.screenshot({ path: 'docs/media/template-library.png', fullPage: true });
await browser.close();
