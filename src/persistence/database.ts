import { validateProjectLimits } from './portable';
import { projectSchema, type Project, type Template } from '../types/project';
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('flawen-studio', 1);
    r.onupgradeneeded = () => {
      for (const name of ['projects', 'templates', 'library', 'settings'])
        r.result.createObjectStore(name, { keyPath: 'id' });
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        connection = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      connection = undefined;
      reject(new Error('Local database is unavailable. Export JSON to keep a backup.'));
    };
    r.onblocked = () => reject(new Error('Close other Studio tabs to update the local database.'));
  }));
}
async function request<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const r = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(r.result);
    tx.onerror = () =>
      reject(new Error('Local save failed. Storage may be full; export your project JSON.'));
    tx.onabort = () => reject(new Error('Local transaction was interrupted.'));
  });
}
export const saveProject = (p: Project) =>
  request('projects', 'readwrite', (s) => {
    validateProjectLimits(p);
    return s.put(projectSchema.parse(p));
  });
export async function listProjects(): Promise<Project[]> {
  const records: unknown[] = await request('projects', 'readonly', (s) => s.getAll());
  return records
    .map((r) => projectSchema.parse(r))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadProject(id: string): Promise<Project | undefined> {
  const raw: unknown = await request('projects', 'readonly', (s) => s.get(id));
  return raw ? projectSchema.parse(raw) : undefined;
}
export const deleteProject = (id: string) => request('projects', 'readwrite', (s) => s.delete(id));
export const saveTemplate = (template: Template) =>
  request('templates', 'readwrite', (s) => s.put(template));
export async function listTemplates(): Promise<Template[]> {
  const records: unknown[] = await request('templates', 'readonly', (s) => s.getAll());
  return records.flatMap((r) => {
    if (
      typeof r !== 'object' ||
      !r ||
      !('id' in r) ||
      !('name' in r) ||
      !('project' in r) ||
      typeof r.id !== 'string' ||
      typeof r.name !== 'string'
    )
      return [];
    return [
      {
        id: r.id,
        name: r.name,
        category: 'Custom',
        description: 'Your saved composition',
        project: projectSchema.parse(r.project),
        custom: true,
      },
    ];
  });
}
export const deleteTemplate = (id: string) =>
  request('templates', 'readwrite', (s) => s.delete(id));
export const savePreference = (id: string, value: unknown) =>
  request('settings', 'readwrite', (s) => s.put({ id, value }));
export async function preference(id: string): Promise<unknown> {
  const r: unknown = await request('settings', 'readonly', (s) => s.get(id));
  return r && typeof r === 'object' && 'value' in r ? r.value : undefined;
}
export const saveLibrary = (id: string, value: unknown) =>
  request('library', 'readwrite', (s) => s.put({ id, value }));
export async function listLibrary(): Promise<{ id: string; value: unknown }[]> {
  const r: unknown[] = await request('library', 'readonly', (s) => s.getAll());
  return r.flatMap((v) =>
    v && typeof v === 'object' && 'id' in v && typeof v.id === 'string' && 'value' in v
      ? [{ id: v.id, value: v.value }]
      : [],
  );
}
