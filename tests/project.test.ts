import { expect, test } from 'vitest';
import { createLayer, createProject } from '../src/types/project';
import { parseProject } from '../src/persistence/portable';
import { useEditor } from '../src/editor/store';
test('editing and reordering preserve Cyrillic text and undo restores the previous scene', () => {
  const text = createLayer('text', { text: 'Команда меняет правила' });
  const p = createProject('Test', { layers: [text, createLayer('logo')] });
  useEditor.getState().open(p);
  useEditor.getState().patchLayer(text.id, { text: 'Новый заголовок', x: 220 });
  expect(useEditor.getState().project.layers[0].text).toBe('Новый заголовок');
  useEditor.getState().undo();
  expect(useEditor.getState().project.layers[0].text).toBe('Команда меняет правила');
  useEditor.getState().redo();
  expect(useEditor.getState().project.layers[0].x).toBe(220);
  useEditor.getState().reorder(text.id, 1);
  expect(useEditor.getState().project.layers[1].id).toBe(text.id);
  expect(parseProject(JSON.stringify(useEditor.getState().project)).layers[1].text).toBe(
    'Новый заголовок',
  );
});
test('portable project rejects unknown schema versions and external assets', () => {
  const p = createProject();
  expect(() => parseProject(JSON.stringify({ ...p, version: 99 }))).toThrow();
  expect(() =>
    parseProject(
      JSON.stringify({
        ...p,
        assets: [
          {
            id: 'bad',
            name: 'bad',
            mime: 'image/png',
            data: 'https://example.com/image.png',
            width: 20,
            height: 20,
          },
        ],
      }),
    ),
  ).toThrow();
});
test('new and imported projects remain unsaved until persistence succeeds', () => {
  const s = useEditor.getState();
  s.open(createProject('Imported'));
  expect(useEditor.getState().savedRevision).not.toBe(useEditor.getState().revision);
  const p = createProject('Saved');
  s.open(p, true);
  expect(useEditor.getState().savedRevision).toBe(useEditor.getState().revision);
});
test('invalid property edits leave the last valid artwork intact', () => {
  const l = createLayer('text');
  useEditor.getState().open(createProject('Valid', { layers: [l] }));
  useEditor.getState().patchLayer(l.id, { fontSize: -10 });
  expect(useEditor.getState().project.layers[0].fontSize).toBe(80);
  expect(useEditor.getState().error).not.toBe('');
});
