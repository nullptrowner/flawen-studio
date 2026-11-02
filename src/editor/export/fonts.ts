import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import interCyrillic from '@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url';
import robotoLatin from '@fontsource-variable/roboto-flex/files/roboto-flex-latin-wght-normal.woff2?url';
import robotoCyrillic from '@fontsource-variable/roboto-flex/files/roboto-flex-cyrillic-wght-normal.woff2?url';
import space from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
import monoLatin from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import monoCyrillic from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-normal.woff2?url';
import monoBoldLatin from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2?url';
import monoBoldCyrillic from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-700-normal.woff2?url';
let cache: Promise<string> | undefined;
export function embeddedFonts() {
  return (cache ??= Promise.all(
    [
      ['Inter Variable', interLatin, '100 900', 'U+0000-024F'],
      ['Inter Variable', interCyrillic, '100 900', 'U+0400-052F'],
      ['Roboto Flex Variable', robotoLatin, '100 900', 'U+0000-024F'],
      ['Roboto Flex Variable', robotoCyrillic, '100 900', 'U+0400-052F'],
      ['Space Grotesk Variable', space, '300 700', 'U+0000-024F'],
      ['IBM Plex Mono', monoLatin, '100 500', 'U+0000-024F'],
      ['IBM Plex Mono', monoCyrillic, '100 500', 'U+0400-052F'],
      ['IBM Plex Mono', monoBoldLatin, '600 900', 'U+0000-024F'],
      ['IBM Plex Mono', monoBoldCyrillic, '600 900', 'U+0400-052F'],
    ].map(async ([name, url, weight, range]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Unable to embed export fonts.');
      const bytes = new Uint8Array(await r.arrayBuffer());
      let raw = '';
      for (let i = 0; i < bytes.length; i += 8192)
        raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return `@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${btoa(raw)}) format('woff2');unicode-range:${range};}`;
    }),
  ).then((css) => `<style type="text/css"><![CDATA[${css.join('\n')}]]></style>`));
}
