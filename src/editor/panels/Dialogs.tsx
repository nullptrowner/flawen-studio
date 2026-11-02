import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Download, Copy, Trash2, Upload } from 'lucide-react';
import { useEditor } from '../store';
import { type Project, createProject, createLayer } from '../../types/project';
import { NumberField, SelectField } from './fields';
import { exportProject, exportBatch, type ExportOptions } from '../export/export';
import { listProjects, saveProject, deleteProject } from '../../persistence/database';
import { parseProject } from '../../persistence/portable';
import { validateAssets } from '../../utils/assets';
import { batchOffers, logoFormats } from '../../templates';
import { parseBatchText } from '../../utils/batch';
import { Thumbnail } from './Library';
import { persistCurrent } from '../../persistence/useWorkspace';
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title} className={wide ? 'wide' : ''}>
      <div className="dialog-heading">
        <div>
          <span className="mono">FLAWEN / STUDIO</span>
          <h2>{title}</h2>
        </div>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [options, setOptions] = useState<ExportOptions>({
      format: 'png',
      width: project.width,
      height: project.height,
      scale: 1,
      quality: 0.95,
      transparent: false,
      layout: 'fit',
    });
  async function run() {
    setBusy(true);
    setMessage('Rendering full-resolution artwork…');
    try {
      await exportProject(project, options);
      setMessage('Export complete. Your download is ready.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Take it out into the world." onClose={onClose}>
      <p className="hint">
        Your artwork, without guides or selection handles. PNG is lossless. SVG keeps vector text
        and embeds procedural SVG artwork and fonts.
      </p>
      <ExportFields options={options} setOptions={setOptions} />
      <p className="hint">
        Fit adds margins. Crop fills the output and trims edges. Reflow repositions objects
        proportionally without stretching logos; review the result for new aspect ratios.
      </p>
      {options.transparent && (
        <p className="hint">
          Transparency exports foreground layers only; the material surface and painted background
          damage are omitted deliberately.
        </p>
      )}
      <div className="dialog-footer">
        <span role="status">
          {message ||
            `${Math.round(options.width * options.scale)} × ${Math.round(options.height * options.scale)} pixels`}
        </span>
        <button className="primary" disabled={busy} onClick={() => void run()}>
          <Download size={16} />
          {busy ? 'Exporting…' : 'Download artwork'}
        </button>
      </div>
    </Dialog>
  );
}
function ExportFields({
  options: o,
  setOptions,
}: {
  options: ExportOptions;
  setOptions: (o: ExportOptions) => void;
}) {
  return (
    <>
      <div className="field-grid">
        <SelectField
          label="Format"
          value={o.format}
          options={['png', 'webp', 'svg', 'json']}
          onChange={(format) => {
            if (format === 'png' || format === 'webp' || format === 'svg' || format === 'json')
              setOptions({ ...o, format });
          }}
        />
        <label className="field">
          <span>Preset size</span>
          <select
            value=""
            onChange={(e) => {
              const [width, height] = e.target.value.split('x').map(Number);
              if (width && height) setOptions({ ...o, width, height });
            }}
          >
            <option value="">Custom / original</option>
            {['512x512', '1024x1024', '1280x720', '1920x1080', '1080x1080', '1080x1920'].map(
              (size) => (
                <option key={size} value={size}>
                  {size.replace('x', ' × ')}
                </option>
              ),
            )}
          </select>
        </label>
        <NumberField
          label="Output width"
          min={64}
          max={8192}
          value={o.width}
          onChange={(width) => setOptions({ ...o, width })}
        />
        <NumberField
          label="Output height"
          min={64}
          max={8192}
          value={o.height}
          onChange={(height) => setOptions({ ...o, height })}
        />
        <NumberField
          label="Scale multiplier"
          min={0.25}
          max={4}
          step={0.25}
          value={o.scale}
          onChange={(scale) => setOptions({ ...o, scale })}
        />
        <SelectField
          label="Aspect ratio behavior"
          value={o.layout}
          options={['fit', 'crop', 'reflow']}
          onChange={(layout) => {
            if (layout === 'fit' || layout === 'crop' || layout === 'reflow')
              setOptions({ ...o, layout });
          }}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={o.transparent}
          onChange={(e) => setOptions({ ...o, transparent: e.target.checked })}
        />{' '}
        Transparent background / foreground only
      </label>
      {o.format === 'webp' && (
        <NumberField
          label="WebP quality"
          min={0.1}
          max={1}
          step={0.05}
          value={o.quality}
          onChange={(quality) => setOptions({ ...o, quality })}
        />
      )}
    </>
  );
}
export function BatchDialog({ onClose }: { onClose: () => void }) {
  const s = useEditor(),
    [count, setCount] = useState(10),
    [start, setStart] = useState(1),
    [subtitle, setSubtitle] = useState('Your next opportunity'),
    [random, setRandom] = useState(true),
    [sharedLogo, setSharedLogo] = useState(true),
    [source, setSource] = useState(''),
    [format, setFormat] = useState<'csv' | 'json'>('csv'),
    [projects, setProjects] = useState<Project[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [options, setOptions] = useState<ExportOptions>({
      format: 'png',
      width: 1280,
      height: 720,
      scale: 1,
      quality: 0.95,
      transparent: false,
      layout: 'fit',
    });
  const file = useRef<HTMLInputElement>(null);
  function generate() {
    try {
      const rows = source.trim() ? parseBatchText(source, format) : [];
      const logo = sharedLogo ? s.project.layers.find((l) => l.kind === 'logo') : undefined;
      const next = batchOffers({
        count: rows.length || count,
        start,
        subtitle,
        titles: rows.length ? rows.map((r) => r.title) : undefined,
        randomize: random,
        logo,
      });
      next.forEach((p, i) => {
        if (logo?.assetId) p.assets = structuredClone(s.project.assets);
        if (rows[i]?.subtitle !== undefined)
          for (const l of p.layers)
            if (l.kind === 'text' && l.name.toLowerCase().includes('subtitle'))
              l.text = rows[i].subtitle ?? '';
      });
      setProjects(next);
      setMessage(`${next.length} editable variations generated.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Generation failed.');
    }
  }
  async function exportAll() {
    setBusy(true);
    try {
      await exportBatch(projects, options, (done) =>
        setMessage(`Exporting ${done} / ${projects.length}…`),
      );
      setMessage('ZIP export complete.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Batch export failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="One system. Many signals." onClose={onClose} wide>
      <div className="batch-layout">
        <div>
          <div className="field-grid">
            <NumberField label="Variations" value={count} min={1} max={30} onChange={setCount} />
            <NumberField
              label="Start number"
              value={start}
              min={1}
              max={9999}
              onChange={setStart}
            />
          </div>
          <label className="field">
            <span>Shared subtitle</span>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />{' '}
            Randomize material seeds
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={sharedLogo}
              onChange={(e) => setSharedLogo(e.target.checked)}
            />{' '}
            Use current artwork’s logo
          </label>
          <SelectField
            label="Bulk data format"
            value={format}
            options={['csv', 'json']}
            onChange={(v) => setFormat(v === 'json' ? 'json' : 'csv')}
          />
          <label className="field">
            <span>Titles / subtitles (optional)</span>
            <textarea
              aria-label="Bulk data"
              placeholder={'title,subtitle\nOFFER #01,Your subtitle'}
              rows={5}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <button className="full-button" onClick={() => file.current?.click()}>
            <Upload size={14} /> Import CSV / JSON
          </button>
          <input
            ref={file}
            hidden
            type="file"
            accept=".csv,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 200 * 1024) {
                  setMessage('Maximum bulk import size is 200 KB.');
                  return;
                }
                setFormat(f.name.endsWith('.json') ? 'json' : 'csv');
                void f
                  .text()
                  .then(setSource)
                  .catch(() => setMessage('Unable to read file.'));
              }
            }}
          />
          <button className="primary full-button" onClick={generate}>
            Generate variations
          </button>
        </div>
        <div>
          <ExportFields options={options} setOptions={setOptions} />
          <div className="batch-previews">
            {projects.map((p) => (
              <div key={p.id}>
                <Thumbnail
                  template={{
                    id: p.id,
                    name: p.name,
                    category: 'Batch',
                    description: '',
                    project: p,
                  }}
                />
                <span>{p.name}</span>
                <button
                  title="Save batch artwork as project"
                  onClick={() =>
                    void saveProject(p)
                      .then(() => setMessage(`${p.name} saved locally.`))
                      .catch(() => setMessage('Save failed.'))
                  }
                >
                  Save project
                </button>
              </div>
            ))}
          </div>
          {!projects.length && (
            <div className="empty-preview">
              01 — ∞<span>GENERATE YOUR NEXT SERIES</span>
            </div>
          )}
        </div>
      </div>
      <div className="dialog-footer">
        <span role="status">
          {message || 'Up to 30 artworks per ZIP. Brand colors stay locked.'}
        </span>
        <button
          className="primary"
          disabled={!projects.length || busy}
          onClick={() => void exportAll()}
        >
          <Download size={16} />
          {busy ? 'Exporting…' : 'Export all as ZIP'}
        </button>
      </div>
    </Dialog>
  );
}
export function ProjectsDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (p: Project) => Promise<void>;
}) {
  const [projects, setProjects] = useState<Project[]>([]),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open storage'));
  };
  useEffect(() => {
    void persistCurrent()
      .then(refresh)
      .catch((e) => setError(String(e)));
  }, []);
  async function duplicate(p: Project) {
    try {
      await saveProject({
        ...structuredClone(p),
        id: crypto.randomUUID(),
        name: p.name + ' copy',
        updatedAt: new Date().toISOString(),
      });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }
  async function remove(p: Project) {
    if (!confirm(`Delete “${p.name}” from this browser? Export a backup first if needed.`)) return;
    try {
      if (useEditor.getState().project.id === p.id) await onOpen(createProject('New artwork'));
      await deleteProject(p.id);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 24_000_000) throw new Error('Maximum project size is 24 MB.');
      const p = await validateAssets(parseProject(await f.text()));
      p.id = crypto.randomUUID();
      await onOpen(p);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Project import failed.');
    }
  }
  return (
    <Dialog title="Your local archive." onClose={onClose} wide>
      <p className="hint">
        Projects are stored in this browser’s IndexedDB. Export JSON for a portable backup; clearing
        browser data removes local projects.
      </p>
      <button className="full-button" onClick={() => input.current?.click()}>
        <Upload size={15} /> Import editable project JSON
      </button>
      <input
        hidden
        ref={input}
        type="file"
        accept=".json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
        }}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="project-list">
        {projects.map((p) => (
          <article key={p.id}>
            <div>
              <h3>{p.name}</h3>
              <span className="mono">
                {p.width} × {p.height} · {new Date(p.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() =>
                void onOpen(p)
                  .then(onClose)
                  .catch((e) => setError(String(e)))
              }
            >
              Open
            </button>
            <button title="Duplicate project" onClick={() => void duplicate(p)}>
              <Copy size={15} />
            </button>
            <button title="Delete project" onClick={() => void remove(p)}>
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </div>
    </Dialog>
  );
}
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useEditor(),
    [width, setWidth] = useState(s.project.width),
    [height, setHeight] = useState(s.project.height),
    [logoFormat, setLogoFormat] = useState<(typeof logoFormats)[number] | null>(null);
  return (
    <Dialog title="Project settings." onClose={onClose}>
      <label className="field">
        <span>Project name</span>
        <input
          value={s.project.name}
          onChange={(e) =>
            s.change(
              'Project renamed',
              (p) => {
                p.name = e.target.value || 'Untitled artifact';
              },
              'name',
            )
          }
        />
      </label>
      <div className="field-grid">
        <NumberField label="Canvas width" min={64} max={4096} value={width} onChange={setWidth} />
        <NumberField
          label="Canvas height"
          min={64}
          max={4096}
          value={height}
          onChange={setHeight}
        />
      </div>
      <h3>Logo formats</h3>
      <div className="category-list">
        {logoFormats.map((format) => (
          <button
            key={format.id}
            onClick={() => {
              setWidth(format.width);
              setHeight(format.height);
              setLogoFormat(format);
            }}
          >
            {format.name}
          </button>
        ))}
      </div>
      <p className="hint">
        Canvas resize preserves objects. Choosing a logo format replaces the composition with a
        centered vector logo (undoable). Use Reflow in Export for other aspect ratios.
      </p>
      <SelectField
        label="Editor surface"
        value={s.theme}
        options={['dark', 'neutral']}
        onChange={(theme) =>
          useEditor.setState({ theme: theme === 'neutral' ? 'neutral' : 'dark' })
        }
      />
      <div className="dialog-footer">
        <span className="mono">MAX 4096 × 4096 ARTBOARD</span>
        <button
          className="primary"
          onClick={() => {
            s.change('Artboard resized', (p) => {
              p.width = Math.round(width);
              p.height = Math.round(height);
              if (logoFormat) {
                const horizontal = logoFormat.variant === 'horizontal';
                p.layers = [
                  createLayer('logo', {
                    name: 'FLAWEN logo',
                    logoVariant: logoFormat.variant,
                    x: width * 0.12,
                    y: height * 0.12,
                    width: width * 0.76,
                    height: height * 0.76,
                    distress: 25,
                  }),
                ];
                if (horizontal) p.layers[0].height = height * 0.76;
                p.strokes = [];
                p.templateId = 'logo';
              }
            });
            useEditor.setState({ fitRequest: s.fitRequest + 1 });
            onClose();
          }}
        >
          Apply settings
        </button>
      </div>
    </Dialog>
  );
}
