import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const out = new URL('../pictures/bots/', import.meta.url);
await mkdir(new URL('projects/', out), { recursive: true });
const sections = {
  'sessions-home': ['СЕССИИ', 'Центр управления'],
  'sessions-list': ['ШАБЛОНЫ', 'Сессии и расписание'],
  'sessions-archive': ['АРХИВ', 'История запусков'],
  'sessions-card': ['СЕССИЯ', 'Управление рабочим циклом'],
  'sessions-offers': ['ОФФЕРЫ', 'Библиотека команды'],
  'sessions-offer': ['ОФФЕР', 'Параметры и предпросмотр'],
  'sessions-destinations': ['ЧАТЫ И ТЕМЫ', 'Пространства команды'],
  'sessions-confirm': ['ПОДТВЕРЖДЕНИЕ', 'Проверьте действие'],
  'sessions-jobs': ['ОТПРАВКИ', 'Доставка и восстановление'],
  'sessions-job': ['ДОСТАВКА', 'Состояние сообщения'],
  'sessions-error': ['ПРОВЕРЬТЕ\nДАННЫЕ', 'Исправьте значение и продолжите'],
  'sessions-saved': ['СОХРАНЕНО', 'Изменения записаны'],
  'sessions-pin': ['ЧАТ ПРИВЯЗАН', 'Пространство готово к работе'],
  'content-home': ['КОНТЕНТ', 'Редакция FLAWEN'],
  'content-list': ['ПУБЛИКАЦИИ', 'Новости и кейсы'],
  'content-edit': ['РЕДАКТИРОВАНИЕ', 'Управление публикацией'],
  'clone-home': ['CLONE', 'Резервное пространство'],
  'clone-status': ['СИНХРОНИЗАЦИЯ', 'Состояние резервной копии'],
  'clone-health': ['ДИАГНОСТИКА', 'Проверка системы'],
  'clone-failed': ['ОШИБКИ', 'Отправки требуют внимания'],
  'clone-retry': ['ВОССТАНОВЛЕНИЕ', 'Контроль повторной отправки'],
  'clone-topics': ['ТЕМЫ', 'Структура резервного чата'],
  'clone-report': ['ОТЧЁТ', 'Подтверждённые результаты синхронизации'],
  'clone-resolve': ['СВЕРКА', 'Проверка соответствия сообщений'],
  'clone-delete': ['УДАЛЕНИЕ', 'Управление резервной копией'],
  'clone-metadata': ['МЕТАДАННЫЕ', 'Оформление резервного чата'],
  'contact-partnership': ['ПАРТНЁРСТВО', 'Новая заявка / FLAWEN'],
  'contact-advertising': ['РЕКЛАМА', 'Новая заявка / FLAWEN'],
  'contact-career': ['КОМАНДА', 'Новая заявка / FLAWEN'],
  'contact-general': ['ОБРАЩЕНИЕ', 'Новая заявка / FLAWEN'],
};
const fields = {
  chat: 'ПРИВЯЗКА ЧАТА',
  network: 'СЕТЬ',
  product: 'ПРОДУКТ',
  source: 'ИСТОЧНИК',
  buyingModel: 'МОДЕЛЬ ЗАКУПКИ',
  payoutModel: 'МОДЕЛЬ ВЫПЛАТ',
  amount: 'СУММА ОФФЕРА',
  duration: 'ДЛИТЕЛЬНОСТЬ',
  age: 'ВОЗРАСТ',
  gender: 'АУДИТОРИЯ',
  geo: 'ГЕОГРАФИЯ',
  creativeMode: 'РЕЖИМ КРЕАТИВА',
  link: 'ССЫЛКА',
  creative: 'КРЕАТИВ',
  name: 'НАЗВАНИЕ',
  destination: 'НАЗНАЧЕНИЕ',
  mode: 'РЕЖИМ СЕССИИ',
  sequence: 'ПОРЯДОК ОФФЕРОВ',
  at: 'РАСПИСАНИЕ',
  ids: 'СВЕРКА ДОСТАВКИ',
};
for (const [k, t] of Object.entries(fields))
  sections[`step-${k}`] = [t, 'Настройка / FLAWEN SESSIONS'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:5180');
await page.getByText('Saved locally', { exact: true }).waitFor();
async function render(project, key) {
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
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download artwork', exact: true }).click();
  await (await pending).saveAs(new URL(key + '.png', out).pathname);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const bytes = await readFile(new URL(key + '.png', out));
  if (bytes.readUInt32BE(16) !== project.width || bytes.readUInt32BE(20) !== project.height)
    throw Error('Invalid dimensions');
  console.log('EXPORTED', key);
}
const manifest = [];
let index = 0;
for (const [key, [title, subtitle]] of Object.entries(sections)) {
  const base = key.startsWith('clone')
    ? '02'
    : key.startsWith('content')
      ? '03'
      : key.startsWith('contact')
        ? '07'
        : String((index % 10) + 1).padStart(2, '0');
  const project = JSON.parse(
    await readFile(new URL(`../pictures/projects/13-offer-${base}.json`, import.meta.url), 'utf8'),
  );
  project.id = randomUUID();
  project.name = `FLAWEN / ${key}`;
  project.background.seed = 14000 + index * 97;
  for (const l of project.layers) {
    if (l.name === 'Headline') {
      l.text = title;
      const lines = title.split('\n');
      l.fontSize = Math.floor(
        Math.min(
          128,
          l.width / (Math.max(...lines.map((x) => x.length)) * 0.76),
          (l.height - 8) / (lines.length * l.lineHeight),
        ),
      );
    }
    if (l.name === 'Subtitle') {
      l.text = subtitle;
      l.fontSize = 20;
    }
    if (l.name === 'Technical label') l.text = 'FLAWEN / ' + key.split('-')[0].toUpperCase();
  }
  await render(project, key);
  manifest.push({ key, width: 1280, height: 720, title });
  index++;
}
for (const [i, bot] of ['sessions', 'contact', 'content', 'clone'].entries()) {
  const project = JSON.parse(
    await readFile(new URL('../pictures/projects/02-bot-avatar.json', import.meta.url), 'utf8'),
  );
  const textBase = JSON.parse(
    await readFile(new URL('../pictures/projects/13-offer-01.json', import.meta.url), 'utf8'),
  ).layers.find((x) => x.name === 'Headline');
  const dark = i === 0 || i === 3;
  project.id = randomUUID();
  project.name = `FLAWEN / avatar-${bot}`;
  project.width = 512;
  project.height = 512;
  project.background.color = dark ? '#111111' : '#f5f5f5';
  project.background.material = dark ? 'Black material' : 'White paper';
  project.background.seed = 19000 + i * 197;
  const logo = project.layers.find((x) => x.kind === 'logo');
  Object.assign(logo, {
    x: 136,
    y: 90,
    width: 240,
    height: 240,
    logoVariant: 'symbol',
    color: dark ? '#ffffff' : '#111111',
    distress: 8,
  });
  const label = {
    ...textBase,
    id: randomUUID(),
    name: 'Bot identity',
    text: bot.toUpperCase(),
    x: 40,
    y: 370,
    width: 432,
    height: 60,
    fontSize: 40,
    align: 'center',
    color: dark ? '#ffffff' : '#111111',
    letterSpacing: 30,
  };
  project.layers = [logo, label];
  await render(project, `avatar-${bot}`);
  manifest.push({ key: `avatar-${bot}`, width: 512, height: 512, title: bot });
}
await writeFile(
  new URL('manifest.json', out),
  JSON.stringify(
    { createdIn: 'FLAWEN STUDIO project import and UI export', images: manifest, errors },
    null,
    2,
  ),
);
await browser.close();
if (errors.length) throw Error(errors.join('\n'));
