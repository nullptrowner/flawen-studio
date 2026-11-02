import { describe, expect, it, vi } from 'vitest';
import { createLayer, projectSchema } from '../src/types/project';
import { batchOffers, builtInTemplates, createFromTemplate } from '../src/templates';

describe('template library', () => {
  it('provides 22 valid editable presets with independent copies', () => {
    expect(builtInTemplates).toHaveLength(22);
    expect(new Set(builtInTemplates.map((template) => template.id)).size).toBe(22);
    for (const template of builtInTemplates) {
      const project = createFromTemplate(template.id);
      expect(projectSchema.safeParse(project).success).toBe(true);
      expect(new Set(project.layers.map((layer) => layer.id)).size).toBe(project.layers.length);
      expect(project.layers.some((layer) => layer.kind === 'text')).toBe(true);
    }
    const first = createFromTemplate('news');
    const second = createFromTemplate('news');
    first.layers[0].name = 'changed';
    expect(second.layers[0].name).not.toBe('changed');
    expect(first.id).not.toBe(second.id);
    expect(first.layers[0].id).not.toBe(second.layers[0].id);
  });
});

describe('offer batches', () => {
  it('cycles ten compositions and numbers offers from the requested start', () => {
    const projects = batchOffers({ count: 12, start: 7, subtitle: 'Verified offer' });
    expect(projects).toHaveLength(12);
    expect(projects[0].layers.find((layer) => layer.name === 'Headline')?.text).toBe('OFFER\n#07');
    expect(projects[11].layers.find((layer) => layer.name === 'Headline')?.text).toBe('OFFER\n#18');
    expect(projects[0].templateId).toBe(projects[10].templateId);
    expect(new Set(projects.slice(0, 10).map((project) => project.templateId)).size).toBe(10);
    const geometries = projects
      .slice(0, 10)
      .map((project) =>
        JSON.stringify(
          project.layers.map(({ x, y, width, height, kind }) => ({ x, y, width, height, kind })),
        ),
      );
    expect(new Set(geometries).size).toBe(10);
    expect(
      projects.every(
        (project) =>
          project.layers.find((layer) => layer.name === 'Subtitle')?.text === 'Verified offer',
      ),
    ).toBe(true);
    expect(projects.every((project) => projectSchema.safeParse(project).success)).toBe(true);
  });
  it('honors custom titles and leaves unverified result values empty', () => {
    const projects = batchOffers({ count: 2, start: 1, subtitle: '', titles: ['Custom title'] });
    expect(projects[0].layers.find((layer) => layer.name === 'Headline')?.text).toBe(
      'Custom title',
    );
    expect(projects[1].layers.find((layer) => layer.name === 'Headline')?.text).toBe('OFFER\n#02');
    for (const id of ['team-cases']) {
      const metricValues = createFromTemplate(id).layers.filter((layer) =>
        layer.name.startsWith('Metric value'),
      );
      expect(metricValues).toHaveLength(3);
      expect(metricValues.every((layer) => layer.text === '')).toBe(true);
    }
  });
});

describe('batch customization', () => {
  it('localizes editable copy and clones a supplied logo without sharing state', () => {
    const suppliedLogo = createLayer('logo', { name: 'Supplied symbol', logoVariant: 'symbol' });
    const projects = batchOffers({
      count: 10,
      start: 1,
      subtitle: 'Новые возможности',
      locale: 'ru',
      randomize: true,
      logo: suppliedLogo,
    });
    expect(new Set(projects.map((project) => project.templateId)).size).toBe(10);
    expect(projects[0].layers.find((layer) => layer.name === 'Headline')?.text).toBe('ОФФЕР\n#01');
    expect(
      createFromTemplate('news', 'ru').layers.find((layer) => layer.name === 'Headline')?.text,
    ).toBe('НОВЫЙ\nСИГНАЛ.');
    const firstLogo = projects[0].layers.find((layer) => layer.kind === 'logo')!;
    expect(firstLogo.logoVariant).toBe('symbol');
    expect(firstLogo.id).not.toBe(suppliedLogo.id);
    firstLogo.effect.seed = 77;
    expect(suppliedLogo.effect.seed).not.toBe(77);
    expect(projects[1].layers.find((layer) => layer.kind === 'logo')?.effect.seed).not.toBe(77);
  });
  it('rejects invalid requests instead of silently generating an empty batch', () => {
    expect(() => batchOffers({ count: 0, start: 1, subtitle: '' })).toThrow(RangeError);
    expect(() => batchOffers({ count: 1, start: -1, subtitle: '' })).toThrow(RangeError);
    expect(() => createFromTemplate('missing')).toThrow('Unknown template');
  });
});

describe('required status headings', () => {
  it('shows the exact requested status prominently in both locales', () => {
    const headings = [
      ['invite-code', 'INVITE CODE ACTIVATED', 'ИНВАЙТ-КОД АКТИВИРОВАН'],
      ['account-connected', 'ACCOUNT CONNECTED', 'АККАУНТ ПОДКЛЮЧЁН'],
      ['session-start', 'SESSION STARTED', 'СЕССИЯ НАЧАЛАСЬ'],
      ['session-results', 'SESSION RESULTS', 'РЕЗУЛЬТАТЫ СЕССИИ'],
    ];
    for (const [id, english, russian] of headings) {
      for (const locale of ['en', 'ru'] as const) {
        const headline = createFromTemplate(id, locale).layers.find(
          (layer) => layer.name === 'Headline',
        )!;
        expect(headline.text.replace(/\s+/g, ' ')).toBe(locale === 'en' ? english : russian);
        expect(headline.fontSize).toBeGreaterThanOrEqual(80);
      }
    }
  });
  it('keeps every preset valid and its text inside the canvas in both locales', () => {
    for (const template of builtInTemplates) {
      for (const locale of ['en', 'ru'] as const) {
        const project = createFromTemplate(template.id, locale);
        expect(projectSchema.safeParse(project).success).toBe(true);
        for (const layer of project.layers.filter((layer) => layer.kind === 'text')) {
          expect(layer.x).toBeGreaterThanOrEqual(0);
          expect(layer.y).toBeGreaterThanOrEqual(0);
          expect(layer.x + layer.width).toBeLessThanOrEqual(project.width);
          expect(layer.y + layer.height).toBeLessThanOrEqual(project.height);
          if (locale === 'ru') expect(layer.fontFamily).toBe('Inter');
        }
      }
    }
  });
});

describe('editorial content fields', () => {
  it('provides named empty fields instead of inventing session data or results', () => {
    const expectedFields: Record<string, string[]> = {
      news: ['Date'],
      sessions: ['Session ID', 'Date', 'Time'],
      'session-results': ['Session name', 'Session ID', 'Date', 'Result'],
      'session-start': ['Session number', 'Start time', 'Date'],
    };
    for (const [id, names] of Object.entries(expectedFields)) {
      for (const locale of ['en', 'ru'] as const) {
        const project = createFromTemplate(id, locale);
        for (const name of names) {
          const field = project.layers.find((layer) => layer.name === name);
          expect(field?.kind).toBe('text');
          expect(field?.text).toBe('');
        }
      }
    }
    expect(
      createFromTemplate('team-cases').layers.find((layer) => layer.name === 'Case number')?.text,
    ).toBe('CASE #01');
    expect(
      createFromTemplate('team-cases', 'ru').layers.find((layer) => layer.name === 'Case number')
        ?.text,
    ).toBe('КЕЙС #01');
  });
  it('uses distinct editorial compositions and explicit offer number markers', () => {
    const ids = ['news', 'about', 'faq', 'navigator', 'partnership'];
    const geometries = ids.map((id) =>
      JSON.stringify(
        createFromTemplate(id).layers.map(({ x, y, width, height, kind }) => ({
          x,
          y,
          width,
          height,
          kind,
        })),
      ),
    );
    expect(new Set(geometries).size).toBe(5);
    expect(
      createFromTemplate('about').layers.find((layer) => layer.name === 'Headline')?.text,
    ).toBe('ABOUT\nTHE TEAM');
    expect(createFromTemplate('faq').layers.find((layer) => layer.name === 'Headline')?.text).toBe(
      'FAQ',
    );
    expect(
      createFromTemplate('partnership').layers.find((layer) => layer.name === 'Headline')?.text,
    ).toBe('PARTNERSHIP');
    expect(
      createFromTemplate('navigator').layers.find(
        (layer) => layer.name === 'Coordinate system label',
      )?.text,
    ).toBe('LAYOUT COORDINATES');
    expect(
      createFromTemplate('offer-01').layers.find((layer) => layer.name === 'Headline')?.text,
    ).toBe('OFFER\n#01');
    expect(
      createFromTemplate('offer-01', 'ru').layers.find((layer) => layer.name === 'Headline')?.text,
    ).toBe('ОФФЕР\n#01');
  });
});

describe('batch material and logo customization', () => {
  it('persists randomized background and effect seeds without modifying the preset', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      const original = createFromTemplate('offer-01');
      const [project] = batchOffers({ count: 1, start: 1, subtitle: '', randomize: true });
      expect(project.background.seed).toBe(536870912);
      expect(Object.values(project.background.seeds).every((seed) => seed === 536870912)).toBe(
        true,
      );
      expect(project.layers.every((layer) => layer.effect.seed === 536870912)).toBe(true);
      expect(projectSchema.safeParse(project).success).toBe(true);
      const [unchanged] = batchOffers({ count: 1, start: 1, subtitle: '' });
      expect(unchanged.background).toEqual(original.background);
      expect(unchanged.layers.map((layer) => layer.effect.seed)).toEqual(
        original.layers.map((layer) => layer.effect.seed),
      );
    } finally {
      random.mockRestore();
    }
  });
  it('centers a custom logo inside every placeholder while retaining its aspect ratio', () => {
    const supplied = createLayer('image', { width: 800, height: 200, assetId: 'uploaded-logo' });
    const [project] = batchOffers({ count: 1, start: 1, subtitle: '', logo: supplied });
    const placeholders = createFromTemplate('offer-01').layers.filter(
      (layer) => layer.kind === 'logo',
    );
    const logos = project.layers.filter((layer) => layer.assetId === 'uploaded-logo');
    expect(logos).toHaveLength(placeholders.length);
    logos.forEach((logo, i) => {
      const box = placeholders[i];
      expect(logo.width / logo.height).toBeCloseTo(4);
      expect(logo.width).toBeLessThanOrEqual(box.width);
      expect(logo.height).toBeLessThanOrEqual(box.height);
      expect(logo.x + logo.width / 2).toBeCloseTo(box.x + box.width / 2);
      expect(logo.y + logo.height / 2).toBeCloseTo(box.y + box.height / 2);
    });
    expect(supplied.width).toBe(800);
    expect(supplied.height).toBe(200);
  });
});
