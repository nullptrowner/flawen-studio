import { useEffect, useState } from 'react';
import { useEditor } from '../editor/store';
import { createFromTemplate } from '../templates';
import { saveProject, loadProject, preference, savePreference, listTemplates } from './database';
import type { Project, Template } from '../types/project';
let queue: Promise<unknown> = Promise.resolve();
export async function persistCurrent() {
  const { project, revision } = useEditor.getState();
  const task = queue
    .catch(() => undefined)
    .then(async () => {
      await saveProject(project);
      await savePreference('last-project', project.id);
    });
  queue = task;
  await task;
  const now = useEditor.getState();
  if (now.project.id === project.id && now.revision === revision)
    useEditor.setState({ savedRevision: revision, status: 'Saved locally' });
}
export function useWorkspace() {
  const [custom, setCustom] = useState<Template[]>([]);
  const ready = useEditor((s) => s.ready),
    revision = useEditor((s) => s.revision);
  const refreshTemplates = () => {
    void listTemplates()
      .then(setCustom)
      .catch((e) =>
        useEditor.setState({
          error: e instanceof Error ? e.message : 'Template storage unavailable',
        }),
      );
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const last = await preference('last-project'),
          p = typeof last === 'string' ? await loadProject(last) : undefined;
        if (!active) return;
        useEditor.getState().open(p ?? createFromTemplate('news'), !!p);
        useEditor.setState({ ready: true });
        refreshTemplates();
      } catch (e) {
        if (!active) return;
        useEditor.getState().open(createFromTemplate('news'));
        useEditor.setState({
          ready: true,
          error:
            e instanceof Error
              ? e.message
              : 'Local storage unavailable. Export JSON to keep your work.',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void persistCurrent().catch((e) =>
        useEditor.setState({
          error: e instanceof Error ? e.message : 'Autosave failed',
          status: 'Not saved — export a backup',
        }),
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [revision, ready]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (s.revision !== s.savedRevision) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, []);
  async function open(project: Project) {
    await persistCurrent();
    useEditor.getState().open(project);
    await persistCurrent();
  }
  return { custom, refreshTemplates, open };
}
