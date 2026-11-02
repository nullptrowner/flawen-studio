import { describe, expect, it } from 'vitest';
import { parseBatchText } from '../src/utils/batch';

describe('batch text import', () => {
  it('reads RFC 4180 quoted commas, newlines and escaped quotes', () => {
    expect(
      parseBatchText(
        'title,subtitle\r\n"Offer, one","Line one\r\nLine ""two"""\r\nSecond,Plain\r\n',
        'csv',
      ),
    ).toEqual([
      { title: 'Offer, one', subtitle: 'Line one\r\nLine "two"' },
      { title: 'Second', subtitle: 'Plain' },
    ]);
  });
});

describe('batch validation', () => {
  it('accepts JSON objects with optional subtitles and preserves intentional whitespace', () => {
    expect(
      parseBatchText('[{"title":"  First  "},{"title":"Second","subtitle":""}]', 'json'),
    ).toEqual([{ title: '  First  ' }, { title: 'Second', subtitle: '' }]);
    expect(parseBatchText('\uFEFFsubtitle,title\nDetail,Title', 'csv')).toEqual([
      { title: 'Title', subtitle: 'Detail' },
    ]);
    expect(parseBatchText('title\nOnly a title', 'csv')).toEqual([{ title: 'Only a title' }]);
  });
  it('rejects malformed JSON and invalid object shapes', () => {
    expect(() => parseBatchText('[{"title":', 'json')).toThrow('Invalid JSON');
    expect(() => parseBatchText('{"title":"x"}', 'json')).toThrow('must be an array');
    for (const json of [
      '[null]',
      '[[]]',
      '[{"title":4}]',
      '[{"title":" "}]',
      '[{"title":"x","subtitle":false}]',
      '[{"title":"x","extra":1}]',
    ]) {
      expect(() => parseBatchText(json, 'json')).toThrow('Row 1');
    }
  });
  it('accepts thirty rows but rejects thirty-one in either format', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ title: `Offer ${i + 1}` }));
    expect(parseBatchText(JSON.stringify(rows), 'json')).toHaveLength(30);
    expect(parseBatchText('title\n' + rows.map((row) => row.title).join('\n'), 'csv')).toHaveLength(
      30,
    );
    expect(() => parseBatchText(JSON.stringify([...rows, { title: 'Extra' }]), 'json')).toThrow(
      'at most 30',
    );
    expect(() =>
      parseBatchText('title\n' + [...rows.map((row) => row.title), 'Extra'].join('\n'), 'csv'),
    ).toThrow('at most 30');
  });
  it('enforces field and byte size limits', () => {
    expect(
      parseBatchText(
        JSON.stringify([{ title: 'a'.repeat(1000), subtitle: 'b'.repeat(2000) }]),
        'json',
      ),
    ).toHaveLength(1);
    expect(() => parseBatchText(JSON.stringify([{ title: 'a'.repeat(1001) }]), 'json')).toThrow(
      '1000 characters',
    );
    expect(() =>
      parseBatchText(JSON.stringify([{ title: 'Title', subtitle: 'b'.repeat(2001) }]), 'json'),
    ).toThrow('2000 characters');
    expect(() => parseBatchText('я'.repeat(110_000), 'csv')).toThrow('200 KB');
  });
  it('rejects broken CSV quoting, headers and column counts', () => {
    expect(() => parseBatchText('title\n"unfinished', 'csv')).toThrow('unclosed');
    expect(() => parseBatchText('title\n"closed"unexpected', 'csv')).toThrow('after closing quote');
    expect(() => parseBatchText('title\nmis"quoted', 'csv')).toThrow('quote must start');
    expect(() => parseBatchText('title,subtitle\nOnly title', 'csv')).toThrow('expected 2 columns');
    expect(() => parseBatchText('title\nTitle,Extra', 'csv')).toThrow('expected 1 columns');
    for (const headers of ['name', 'subtitle', 'title,title', 'title,unknown']) {
      expect(() => parseBatchText(headers + '\nvalue', 'csv')).toThrow('CSV headers');
    }
    expect(() => parseBatchText('title\n', 'csv')).toThrow('at least one row');
    expect(() => parseBatchText('[]', 'json')).toThrow('at least one row');
  });
});
