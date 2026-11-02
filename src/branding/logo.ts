import type { Layer } from '../types/project';
import { n, seededRandom, svg } from '../effects/shared';

// Original geometric lettering; paths keep export independent of installed fonts.
const letters: Record<string, string> = {
  F: 'M0 0H44V11H13V26H38V37H13V64H0Z',
  L: 'M0 0H13V52H44V64H0Z',
  A: 'M0 64L18 0H34L52 64H38L35 51H16L13 64ZM19 40H32L25.5 14Z',
  W: 'M0 0H13L21 43L30 0H43L52 43L60 0H73L60 64H46L36 23L26 64H12Z',
  E: 'M0 0H44V11H13V26H38V37H13V53H44V64H0Z',
  N: 'M0 64V0H13L38 41V0H51V64H38L13 23V64Z',
};
function wordmark(): string {
  let x = 0;
  return (
    '<g mask="url(#word-distress)">' +
    [...'FLAWEN']
      .map((letter) => {
        const element = `<path d="${letters[letter]}" transform="translate(${x} 0)" fill-rule="evenodd"/>`;
        x += (letter === 'W' ? 73 : letter === 'A' ? 52 : letter === 'N' ? 51 : 44) + 9;
        return element;
      })
      .join('') +
    '</g>'
  );
}

export function logoSvg(layer: Layer): string {
  const random = seededRandom(layer.effect.seed);
  const chips: string[] = [];
  for (let i = 0; i < Math.round(layer.distress * 0.8); i++) {
    const y = random() * 120;
    const x = 89 + random() * 30;
    const r = 1 + random() * layer.distress * 0.06;
    chips.push(
      `<path d="M${n(x)} ${n(y)} l${n(r * 2)} ${n(-r)} l${n(r)} ${n(r * 2)} l${n(-r * 3)} ${n(r)}Z" fill="#000000"/>`,
    );
  }
  const wordRandom = seededRandom(layer.effect.seed + 77);
  const wordChips: string[] = [];
  for (let i = 0; i < Math.round(layer.distress * 0.5); i++) {
    const x = 300 + wordRandom() * 55,
      y = wordRandom() * 64;
    const r = 0.3 + wordRandom() * layer.distress * 0.02;
    wordChips.push(
      `<path d="M${n(x)} ${n(y)} l${n(r * 3)} ${n(-r)} l${n(-r)} ${n(r * 3)}Z" fill="#000000"/>`,
    );
  }
  const symbol = `<g mask="url(#logo-distress)"><path fill-rule="evenodd" d="M0 0H120V120H0ZM9 9V111H111V9Z"/><path d="M26 25H96V42H47V56H85V73H47V96H26Z"/></g>`;
  let artwork: string;
  let naturalWidth: number;
  let naturalHeight: number;
  switch (layer.logoVariant) {
    case 'symbol':
      artwork = symbol;
      naturalWidth = 120;
      naturalHeight = 120;
      break;
    case 'wordmark':
      artwork = wordmark();
      naturalWidth = 353;
      naturalHeight = 64;
      break;
    case 'vertical':
      artwork = `${symbol}<g transform="translate(-116.5 148)">${wordmark()}</g>`;
      naturalWidth = 353;
      naturalHeight = 212;
      artwork = `<g transform="translate(116.5 0)">${artwork}</g>`;
      break;
    case 'full':
      artwork = `${symbol}<g transform="translate(150 28)">${wordmark()}</g><path d="M150 111H503V114H150Z"/>`;
      naturalWidth = 503;
      naturalHeight = 120;
      break;
    default:
      artwork = `${symbol}<g transform="translate(150 28)">${wordmark()}</g>`;
      naturalWidth = 503;
      naturalHeight = 120;
  }
  const scale = Math.min(layer.width / naturalWidth, layer.height / naturalHeight);
  const x = (layer.width - naturalWidth * scale) / 2;
  const y = (layer.height - naturalHeight * scale) / 2;
  return svg(
    layer.width,
    layer.height,
    `<defs><mask id="logo-distress" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120" style="mask-type:luminance"><rect width="120" height="120" fill="#ffffff"/>${chips.join('')}</mask><mask id="word-distress" maskUnits="userSpaceOnUse" x="0" y="0" width="353" height="64" style="mask-type:luminance"><rect width="353" height="64" fill="#ffffff"/>${wordChips.join('')}</mask></defs><g fill="${layer.color}" transform="translate(${n(x)} ${n(y)}) scale(${Number(scale.toFixed(6))})">${artwork}</g>`,
  );
}
