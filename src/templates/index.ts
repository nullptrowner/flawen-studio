import {
  createLayer,
  createProject,
  defaultBackground,
  projectSchema,
  type Layer,
  type Project,
  type Template,
} from '../types/project';

type Locale = 'en' | 'ru';
const ink = '#111111';
const paper = '#f5f5f5';
const translations: Record<string, string> = {
  'LATEST\nSIGNAL.': 'НОВЫЙ\nСИГНАЛ.',
  'News & updates': 'Новости и обновления',
  'WORK.\nWITH PROOF.': 'ДЕЛО.\nС РЕЗУЛЬТАТОМ.',
  'Team cases': 'Кейсы команды',
  'BUILT\nDIFFERENT.': 'СВОЙ\nПОДХОД.',
  'About the team': 'О команде',
  'GOOD\nQUESTIONS.': 'ВАЖНЫЕ\nВОПРОСЫ.',
  'Frequently asked questions': 'Частые вопросы',
  'NEXT\nSESSION.': 'НОВАЯ\nСЕССИЯ.',
  'Sessions & schedule': 'Сессии и расписание',
  'BETTER\nTOGETHER.': 'СИЛЬНЕЕ\nВМЕСТЕ.',
  Partnership: 'Партнёрство',
  'FIND YOUR\nDIRECTION.': 'НАЙДИ СВОЙ\nМАРШРУТ.',
  Navigator: 'Навигатор',
  'INVITE CODE\nACTIVATED': 'ИНВАЙТ-КОД\nАКТИВИРОВАН',
  'Invite code activated': 'Инвайт-код активирован',
  'ACCOUNT\nCONNECTED': 'АККАУНТ\nПОДКЛЮЧЁН',
  'Account connected': 'Аккаунт подключён',
  'SESSION\nRESULTS': 'РЕЗУЛЬТАТЫ\nСЕССИИ',
  'Session results': 'Результаты сессии',
  'SESSION\nSTARTED': 'СЕССИЯ\nНАЧАЛАСЬ',
  'Session starts now': 'Сессия начинается',
  'Your next opportunity': 'Твоя следующая возможность',
  'OPEN\nPOSSIBILITIES': 'НОВЫЕ\nВОЗМОЖНОСТИ',
  'Add your update here.': 'Добавьте новость здесь.',
  'Add a verified case and its source.': 'Добавьте проверенный кейс и источник.',
  'Independent minds. Shared direction.': 'Независимое мышление. Общая цель.',
  'Add a question and a clear answer.': 'Добавьте вопрос и понятный ответ.',
  'Add the date, time and session details.': 'Добавьте дату, время и детали сессии.',
  'Create something worth sharing.': 'Создаём то, чем хочется делиться.',
  'Choose a section. Take the next step.': 'Выберите раздел. Сделайте следующий шаг.',
  'Your access is ready.': 'Ваш доступ готов.',
  'Ready for the next step.': 'Всё готово к следующему шагу.',
  'Add confirmed outcomes after the session.': 'Добавьте подтверждённые итоги сессии.',
  'Focus. Connect. Move forward.': 'Фокус. Контакт. Движение вперёд.',
  'ABOUT\nTHE TEAM': 'О НАС\nКОМАНДА',
  FAQ: 'FAQ',
  PARTNERSHIP: 'ПАРТНЁРСТВО',
  NAVIGATOR: 'НАВИГАТОР',
  'STRUCTURE / CULTURE': 'СТРУКТУРА / КУЛЬТУРА',
  '01 / START': '01 / НАЧАЛО',
  '02 / EXPLORE': '02 / ОБЗОР',
  '03 / CONNECT': '03 / КОНТАКТ',
  'LAYOUT COORDINATES': 'КООРДИНАТЫ МАКЕТА',
  'YOUR TEAM': 'ВАША КОМАНДА',
  PARTNER: 'ПАРТНЁР',
  DATE: 'ДАТА',
  TIME: 'ВРЕМЯ',
  'SESSION ID': 'ID СЕССИИ',
  'SESSION NAME': 'НАЗВАНИЕ СЕССИИ',
  'SESSION NUMBER': 'НОМЕР СЕССИИ',
  'START TIME': 'ВРЕМЯ НАЧАЛА',
  'CASE #01': 'КЕЙС #01',
  RESULT: 'РЕЗУЛЬТАТ',
  PERIOD: 'ПЕРИОД',
  SOURCE: 'ИСТОЧНИК',
};

function text(
  name: string,
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color = ink,
  extra: Partial<Layer> = {},
): Layer {
  return createLayer('text', {
    name,
    text: value,
    x,
    y,
    width,
    height: Math.ceil(size * 1.14 * value.split('\n').length + 12),
    fontFamily: 'Inter',
    fontSize: size,
    fontWeight: 750,
    lineHeight: 1.04,
    letterSpacing: -25,
    color,
    distress: 0,
    ...extra,
  });
}
function box(
  x: number,
  y: number,
  width: number,
  height: number,
  color = ink,
  shape: Layer['shape'] = 'rectangle',
): Layer {
  return createLayer('shape', {
    name: shape === 'circle' ? 'Disc' : 'Band',
    x,
    y,
    width,
    height,
    color,
    shape,
    strokeWidth: 0,
    distress: 0,
  });
}
function rule(x: number, y: number, width: number, color = ink): Layer {
  return box(x, y, width, 2, color);
}
function logo(
  x: number,
  y: number,
  width = 172,
  color = ink,
  variant: Layer['logoVariant'] = 'horizontal',
): Layer {
  return createLayer('logo', {
    name: 'FLAWEN logo',
    x,
    y,
    width,
    height: variant === 'symbol' ? width : width * 0.24,
    color,
    logoVariant: variant,
    distress: 0,
    strokeWidth: 0,
  });
}
function metadata(index: string, dark = false): Layer[] {
  const color = dark ? paper : ink;
  return [
    logo(56, 38, 152, color),
    text('Technical label', `FLAWEN® / ${index}`, 947, 45, 277, 13, color, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      align: 'right',
      letterSpacing: 0,
    }),
    rule(56, 650, 1168, color),
    text('Edition', 'INDEPENDENT BY DESIGN', 56, 672, 500, 12, color, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      letterSpacing: 30,
    }),
    text('Format', '1280 × 720 / 16:9', 984, 672, 240, 12, color, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      letterSpacing: 0,
      align: 'right',
    }),
  ];
}
function preset(
  id: string,
  name: string,
  category: string,
  layers: Layer[],
  dark = false,
  square = false,
): Template {
  return {
    id,
    name,
    category,
    description: `Editable ${name.toLowerCase()} composition. ${square ? 'Square identity study.' : '1280 × 720 editorial layout.'}`,
    project: createProject(name, {
      templateId: id,
      width: square ? 1024 : 1280,
      height: square ? 1024 : 720,
      background: {
        ...structuredClone(defaultBackground),
        color: dark ? ink : paper,
        wear: 0,
        grain: 3,
        cracks: 0,
        scratches: 0,
        erosion: 0,
        edge: 0,
        dust: 0,
      },
      layers,
    }),
  };
}

const editorial = [
  ['news', 'News', 'LATEST\nSIGNAL.', 'News & updates', 'Add your update here.'],
  [
    'team-cases',
    'Team cases',
    'WORK.\nWITH PROOF.',
    'Team cases',
    'Add a verified case and its source.',
  ],
  ['about', 'About', 'BUILT\nDIFFERENT.', 'About the team', 'Independent minds. Shared direction.'],
  [
    'faq',
    'FAQ',
    'GOOD\nQUESTIONS.',
    'Frequently asked questions',
    'Add a question and a clear answer.',
  ],
  [
    'sessions',
    'Sessions',
    'NEXT\nSESSION.',
    'Sessions & schedule',
    'Add the date, time and session details.',
  ],
  [
    'partnership',
    'Partnership',
    'BETTER\nTOGETHER.',
    'Partnership',
    'Create something worth sharing.',
  ],
  [
    'navigator',
    'Navigator',
    'FIND YOUR\nDIRECTION.',
    'Navigator',
    'Choose a section. Take the next step.',
  ],
  [
    'invite-code',
    'Invite code activated',
    'INVITE CODE\nACTIVATED',
    'Invite code activated',
    'Your access is ready.',
  ],
  [
    'account-connected',
    'Account connected',
    'ACCOUNT\nCONNECTED',
    'Account connected',
    'Ready for the next step.',
  ],
  [
    'session-results',
    'Session results',
    'SESSION\nRESULTS',
    'Session results',
    'Add confirmed outcomes after the session.',
  ],
] as const;

function blankField(name: string, x: number, y: number, width: number, color = ink): Layer[] {
  return [
    text(`${name} label`, name.toUpperCase(), x, y, width, 12, color, {
      fontFamily: 'IBM Plex Mono',
      fontWeight: 400,
      letterSpacing: 0,
    }),
    text(name, '', x, y + 23, width, 26, color, { fontWeight: 450, letterSpacing: 0 }),
    rule(x, y + 69, width, color),
  ];
}

function editorialPreset(entry: (typeof editorial)[number], index: number): Template {
  const [id, name, headline, subtitle, body] = entry;
  const dark = id === 'about' || id === 'invite-code';
  const foreground = dark ? paper : ink;
  const layers = metadata(String(index + 2).padStart(2, '0'), dark);
  if (id === 'about') {
    layers.push(
      text('Subtitle', subtitle, 58, 128, 700, 20, paper, { fontWeight: 450, letterSpacing: 0 }),
      text('Headline', 'ABOUT\nTHE TEAM', 50, 207, 724, 112, paper),
      text('Body', body, 58, 545, 704, 21, paper, { fontWeight: 400, letterSpacing: 0 }),
      box(793, 154, 1, 450, '#555555'),
    );
    for (let i = 0; i <= 3; i++)
      layers.push(
        box(830 + i * 122, 174, 1, 330, '#555555'),
        rule(830, 174 + i * 110, 366, '#555555'),
      );
    layers.push(
      logo(918, 260, 190, paper, 'symbol'),
      text('Grid caption', 'STRUCTURE / CULTURE', 830, 540, 380, 15, paper, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
    );
    return preset(id, name, 'Editorial', layers, true);
  }
  if (id === 'faq') {
    layers.push(
      text('Subtitle', subtitle, 58, 128, 840, 20, ink, { fontWeight: 450, letterSpacing: 0 }),
      text('Headline', 'FAQ', 44, 189, 750, 238),
      text('Question mark', '?', 939, 177, 255, 260, ink, { fontWeight: 300, align: 'center' }),
      rule(56, 499, 1168),
      text('Body', body, 58, 553, 1050, 26, ink, { fontWeight: 400, letterSpacing: 0 }),
    );
    return preset(id, name, 'Editorial', layers);
  }
  if (id === 'partnership') {
    layers.push(
      text('Headline', 'PARTNERSHIP', 49, 137, 1175, 111),
      rule(56, 293, 1168),
      box(639, 327, 2, 222),
      logo(237, 334, 150, ink, 'symbol'),
      logo(821, 384, 266),
      text('Left partner label', 'YOUR TEAM', 56, 513, 550, 16, ink, {
        align: 'center',
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Right partner label', 'PARTNER', 674, 513, 550, 16, ink, {
        align: 'center',
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Body', body, 58, 589, 1120, 22, ink, { fontWeight: 400, letterSpacing: 0 }),
    );
    return preset(id, name, 'Editorial', layers);
  }
  if (id === 'navigator') {
    layers.push(
      text('Headline', 'NAVIGATOR', 49, 141, 1175, 112),
      text('Route start', '01 / START', 111, 290, 300, 22),
      text('Route middle', '02 / EXPLORE', 551, 347, 365, 22),
      text('Route end', '03 / CONNECT', 823, 526, 365, 22),
      rule(120, 350, 400),
      box(519, 350, 2, 130),
      rule(520, 480, 540),
    );
    for (const [x, y] of [
      [120, 350],
      [520, 350],
      [520, 480],
      [1060, 480],
    ])
      layers.push(box(x - 8, y - 8, 16, 16, ink, 'circle'));
    layers.push(
      text('Coordinate start', 'X 00 / Y 00', 111, 382, 280, 13, ink, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Coordinate end', 'X 01 / Y 01', 961, 427, 240, 13, ink, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Coordinate system label', 'LAYOUT COORDINATES', 58, 564, 610, 12, ink, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Body', body, 58, 602, 1120, 20, ink, { fontWeight: 400, letterSpacing: 0 }),
    );
    return preset(id, name, 'Editorial', layers);
  }
  layers.push(
    text('Subtitle', subtitle, 58, 128, 840, 20, foreground, { fontWeight: 450, letterSpacing: 0 }),
  );
  layers.push(
    text(
      'Headline',
      headline,
      50,
      193,
      id === 'account-connected' ? 1170 : 880,
      id === 'account-connected' ? 100 : 104,
      foreground,
    ),
  );
  layers.push(
    text('Body', body, 58, id === 'sessions' ? 488 : 548, 850, 23, foreground, {
      fontWeight: 400,
      letterSpacing: 0,
    }),
  );
  if (id === 'session-results') {
    for (const [i, field] of ['Session name', 'Session ID', 'Date', 'Result'].entries())
      layers.push(...blankField(field, 980, 195 + i * 104, 228));
  } else if (id === 'team-cases') {
    layers.push(
      text('Case number', 'CASE #01', 58, 482, 700, 22, ink, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
    );
    for (const [i, label] of ['RESULT', 'PERIOD', 'SOURCE'].entries()) {
      layers.push(
        text(`Metric label ${i + 1}`, label, 980, 220 + i * 116, 228, 13, foreground, {
          fontFamily: 'IBM Plex Mono',
          fontWeight: 400,
          letterSpacing: 0,
        }),
      );
      layers.push(text(`Metric value ${i + 1}`, '', 980, 246 + i * 116, 228, 32, foreground));
      layers.push(rule(980, 303 + i * 116, 228, foreground));
    }
  } else if (id === 'account-connected') {
    layers.push(rule(58, 488, 1148), box(1104, 513, 72, 72, ink, 'circle'));
  } else if (id === 'sessions') {
    layers.push(
      box(1012, 209, 176, 320),
      text('Session marker', 'LIVE', 1027, 344, 146, 40, paper, { align: 'center', rotation: -90 }),
    );
  } else {
    layers.push(
      box(1000, 250, 204, 204, foreground, 'circle'),
      logo(1046, 296, 112, dark ? ink : paper, 'symbol'),
    );
  }
  if (id === 'news') layers.push(...blankField('Date', 980, 539, 228));
  if (id === 'sessions')
    for (const [i, field] of ['Session ID', 'Date', 'Time'].entries())
      layers.push(...blankField(field, 58 + i * 300, 551, 266));
  return preset(id, name, 'Editorial', layers, dark);
}

function offerPreset(index: number): Template {
  const number = String(index + 1).padStart(2, '0');
  const dark = index === 1 || index === 5 || index === 8;
  const fg = dark ? paper : ink;
  const layers = metadata(`LAYOUT / ${number}`, dark);
  const title = (
    x: number,
    y: number,
    width: number,
    size: number,
    color = fg,
    align: Layer['align'] = 'left',
  ) => text('Headline', `OFFER\n#${number}`, x, y, width, size, color, { align });
  const subtitle = (x: number, y: number, width = 760, color = fg) =>
    text('Subtitle', 'Your next opportunity', x, y, width, 24, color, {
      fontWeight: 400,
      letterSpacing: 0,
    });
  switch (index) {
    case 0:
      layers.push(
        title(52, 171, 760, 142),
        subtitle(61, 536),
        box(970, 228, 234, 234, ink, 'circle'),
        logo(1025, 283, 124, paper, 'symbol'),
      );
      break;
    case 1:
      layers.push(
        box(0, 108, 348, 512, paper),
        logo(86, 269, 174, ink, 'symbol'),
        title(416, 172, 800, 140),
        subtitle(424, 535),
      );
      break;
    case 2:
      layers.push(
        rule(56, 170, 1168),
        title(462, 207, 744, 128),
        subtitle(464, 525, 730),
        text('Side note', 'OPEN\nPOSSIBILITIES', 57, 232, 334, 34, ink, { fontWeight: 450 }),
        logo(64, 430, 105, ink, 'symbol'),
      );
      break;
    case 3:
      layers.push(
        box(56, 129, 1168, 448),
        title(97, 163, 760, 131, paper),
        subtitle(100, 504, 850, paper),
        logo(993, 179, 166, paper, 'symbol'),
      );
      break;
    case 4:
      layers.push(
        box(854, 129, 370, 470),
        logo(940, 265, 194, paper, 'symbol'),
        title(52, 173, 760, 128),
        subtitle(60, 534, 740),
      );
      break;
    case 5:
      layers.push(
        createLayer('frame', {
          name: 'Inset frame',
          x: 55,
          y: 126,
          width: 1170,
          height: 477,
          color: paper,
          stroke: paper,
          strokeWidth: 2,
          distress: 0,
        }),
        title(100, 168, 1080, 129, paper, 'center'),
        text('Subtitle', 'Your next opportunity', 220, 523, 840, 24, paper, {
          align: 'center',
          fontWeight: 400,
          letterSpacing: 0,
        }),
      );
      break;
    case 6:
      layers.push(
        box(58, 136, 14, 470),
        title(122, 179, 850, 137),
        subtitle(129, 535, 850),
        logo(1070, 143, 116, ink, 'symbol'),
      );
      break;
    case 7:
      layers.push(
        box(760, 126, 440, 440, '#e1e1e1', 'circle'),
        logo(911, 271, 146, ink, 'symbol'),
        title(53, 181, 712, 132),
        subtitle(62, 543, 710),
      );
      break;
    case 8:
      layers.push(
        title(55, 145, 920, 137),
        box(0, 499, 1280, 114, paper),
        subtitle(60, 540, 900, ink),
        logo(1090, 528, 55, ink, 'symbol'),
        rule(1000, 179, 198, paper),
      );
      break;
    case 9:
      layers.push(
        box(57, 140, 285, 414),
        logo(108, 250, 180, paper, 'symbol'),
        title(400, 173, 820, 133),
        subtitle(409, 538, 790),
        rule(408, 499, 794),
      );
      break;
  }
  return preset(`offer-${number}`, `Offer ${number}`, 'Offers', layers, dark);
}

export const builtInTemplates: Template[] = [
  preset(
    'logo',
    'Logo / identity',
    'Identity',
    [
      text('Identity label', 'FLAWEN® / IDENTITY SYSTEM', 64, 58, 880, 16, ink, {
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        letterSpacing: 0,
      }),
      logo(347, 221, 330, ink, 'symbol'),
      logo(194, 656, 636, ink, 'wordmark'),
      rule(64, 912, 896),
      text('Identity footer', 'NOTHING STAYS FLAWLESS.', 64, 939, 890, 18, ink, {
        fontWeight: 450,
        letterSpacing: 0,
      }),
    ],
    false,
    true,
  ),
  ...editorial.map(editorialPreset),
  ...Array.from({ length: 10 }, (_, i) => offerPreset(i)),
  preset(
    'session-start',
    'Session start',
    'Editorial',
    [
      ...metadata('22', true),
      text('Subtitle', 'Session starts now', 60, 131, 880, 22, paper, {
        fontWeight: 400,
        letterSpacing: 0,
      }),
      text('Headline', 'SESSION\nSTARTED', 52, 198, 840, 136, paper),
      text('Body', 'Focus. Connect. Move forward.', 60, 551, 930, 24, paper, {
        fontWeight: 400,
        letterSpacing: 0,
      }),
      ...['Session number', 'Start time', 'Date'].flatMap((field, i) =>
        blankField(field, 970, 188 + i * 132, 244, paper),
      ),
    ],
    true,
  ),
];

function freshLayer(layer: Layer): Layer {
  return {
    ...structuredClone(layer),
    id: crypto.randomUUID(),
    children: layer.children.map(freshLayer),
  };
}
export function createFromTemplate(id: string, locale: Locale = 'en'): Project {
  const template = builtInTemplates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  const source = structuredClone(template.project);
  const layers = source.layers.map(freshLayer);
  if (locale === 'ru') {
    for (const layer of layers) {
      if (layer.kind !== 'text') continue;
      layer.text = translations[layer.text] ?? layer.text.replace(/^OFFER\n/, 'ОФФЕР\n');
      layer.fontFamily = 'Inter';
      fitText(layer);
    }
  }
  return createProject(template.name, {
    ...source,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    layers,
  });
}

// Conservative sizing preserves the editable text box when a custom title grows.
function fitText(layer: Layer): void {
  const lines = layer.text.split('\n');
  const longest = Math.max(1, ...lines.map((line) => [...line].length));
  layer.fontSize = Math.max(
    4,
    Math.min(
      layer.fontSize,
      layer.width / (longest * 0.76),
      (layer.height - 8) / (lines.length * layer.lineHeight),
    ),
  );
}

export const logoFormats = [
  { id: 'avatar', name: 'Avatar', width: 512, height: 512, variant: 'symbol' },
  { id: 'horizontal', name: 'Horizontal logo', width: 1600, height: 400, variant: 'horizontal' },
  { id: 'square-mono', name: 'Square monochrome', width: 1024, height: 1024, variant: 'vertical' },
] as const;

export interface BatchOfferOptions {
  count: number;
  start: number;
  subtitle: string;
  titles?: string[];
  randomize?: boolean;
  logo?: Layer;
  locale?: Locale;
}

export function batchOffers(options: BatchOfferOptions): Project[] {
  const {
    count,
    start,
    subtitle,
    titles = [],
    randomize = false,
    logo: customLogo,
    locale = 'en',
  } = options;
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new RangeError('Offer count must be between 1 and 100.');
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(start + count - 1))
    throw new RangeError('Offer start must be a non-negative safe integer.');
  const order = Array.from({ length: 10 }, (_, i) => i + 1);
  if (randomize) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  return Array.from({ length: count }, (_, index) => {
    const number = String(start + index).padStart(2, '0');
    const project = createFromTemplate(
      `offer-${String(order[index % order.length]).padStart(2, '0')}`,
      locale,
    );
    project.name = `${locale === 'ru' ? 'Оффер' : 'Offer'} ${number}`;
    project.layers = project.layers.map((layer) => {
      if (customLogo && layer.kind === 'logo') {
        const scale = Math.min(layer.width / customLogo.width, layer.height / customLogo.height);
        const width = customLogo.width * scale,
          height = customLogo.height * scale;
        return {
          ...freshLayer(customLogo),
          name: layer.name,
          x: layer.x + (layer.width - width) / 2,
          y: layer.y + (layer.height - height) / 2,
          width,
          height,
        };
      }
      if (layer.name === 'Headline') {
        layer.text = titles[index] ?? `${locale === 'ru' ? 'ОФФЕР' : 'OFFER'}\n#${number}`;
        fitText(layer);
      }
      if (layer.name === 'Subtitle') {
        layer.text = subtitle;
        fitText(layer);
      }
      return layer;
    });
    if (randomize) {
      const seed = () => Math.floor(Math.random() * 2147483648);
      project.background.seed = seed();
      project.background.seeds = {
        cracks: seed(),
        scratches: seed(),
        erosion: seed(),
        grain: seed(),
      };
      const randomizeLayers = (layers: Layer[]) => {
        for (const layer of layers) {
          layer.effect.seed = seed();
          randomizeLayers(layer.children);
        }
      };
      randomizeLayers(project.layers);
      for (const stroke of project.strokes) stroke.seed = seed();
    }
    return projectSchema.parse(project);
  });
}
