import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  LockKeyhole,
  UnlockKeyhole,
  GripVertical,
  Trash2,
  Upload,
  Type,
  Layers,
  Frame,
  ScanLine,
  Sparkles,
  Image,
  Stamp,
  Square,
  Copy,
  FolderOpen,
} from 'lucide-react';
import { useEditor, cloneLayer } from '../store';
import { createLayer, crackPresets, type Layer, type Template } from '../../types/project';
import { builtInTemplates } from '../../templates';
import { projectThumbnail } from '../canvas/render';
import { logoSvg } from '../../branding/logo';
import { svgData, importAsset } from '../../utils/assets';
import { listLibrary, deleteTemplate, saveTemplate } from '../../persistence/database';
import { parseLibraryEntry, type LibraryEntry } from '../../persistence/library';
const tabs = [
  { name: 'Templates', icon: Frame },
  { name: 'Text', icon: Type },
  { name: 'Logo', icon: Stamp },
  { name: 'Elements', icon: Square },
  { name: 'Textures', icon: Image },
  { name: 'Cracks', icon: ScanLine },
  { name: 'Scratches', icon: Sparkles },
  { name: 'Backgrounds', icon: Frame },
  { name: 'Assets', icon: FolderOpen },
  { name: 'Layers', icon: Layers },
];
let thumbnailQueue = Promise.resolve();
const thumbnailCache = new Map<string, string>();
export function Thumbnail({ template }: { template: Template }) {
  const [src, setSrc] = useState(thumbnailCache.get(template.id + template.project.updatedAt));
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const key = template.id + template.project.updatedAt;
    if (thumbnailCache.has(key)) {
      setSrc(thumbnailCache.get(key));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        thumbnailQueue = thumbnailQueue.then(async () => {
          if (!active) return;
          try {
            const image = await projectThumbnail(template.project, 320);
            thumbnailCache.set(key, image);
            if (active) setSrc(image);
          } catch {
            if (active) setSrc(undefined);
          }
        });
      },
      { rootMargin: '200px' },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [template]);
  return (
    <div className="template-thumb" ref={host}>
      {src ? (
        <img src={src} alt={`${template.name} artwork`} />
      ) : (
        <span>
          FLAWEN<span>RENDERING ARTWORK</span>
        </span>
      )}
    </div>
  );
}
interface Props {
  custom: Template[];
  onTemplate: (id: string) => void;
  onCustom: (template: Template) => void;
  onTemplatesChanged: () => void;
  onBatch: () => void;
}
export function Library({ custom, onTemplate, onCustom, onTemplatesChanged, onBatch }: Props) {
  const [tab, setTab] = useState('Templates'),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All'),
    [saved, setSaved] = useState<LibraryEntry[]>([]);
  const s = useEditor();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tab === 'Logo' || tab === 'Text')
      void listLibrary()
        .then((items) =>
          setSaved(
            items.flatMap((item) => {
              const parsed = parseLibraryEntry(item.value);
              return parsed ? [parsed] : [];
            }),
          ),
        )
        .catch((error) =>
          useEditor.setState({
            error: error instanceof Error ? error.message : 'Library unavailable',
          }),
        );
  }, [tab]);
  function addSaved(entry: LibraryEntry) {
    const layer = { ...cloneLayer(entry.layer), x: 100, y: 100 };
    s.change('Library item added', (p) => {
      for (const asset of entry.assets)
        if (!p.assets.some((a) => a.id === asset.id)) p.assets.push(asset);
      p.layers.push(layer);
    });
    s.select([layer.id]);
  }
  const templates = [...builtInTemplates, ...custom].filter(
    (t) =>
      (category === 'All' || t.category === category) &&
      `${t.name} ${t.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const addText = (
    label: string,
    fontSize: number,
    fontWeight: number,
    fontFamily: Layer['fontFamily'] = 'Inter',
  ) =>
    s.add(
      createLayer('text', {
        name: label,
        text: label === 'Large offer number' ? '01' : label.toUpperCase(),
        fontSize,
        fontWeight,
        fontFamily,
        width: label === 'Large offer number' ? 450 : 800,
        height: fontSize * 1.6,
      }),
    );
  async function upload(file: File) {
    try {
      const asset = await importAsset(file);
      if (s.project.assets.length >= 50) throw new Error('Maximum 50 embedded assets.');
      s.change('Asset imported', (p) => p.assets.push(asset));
      s.add(
        createLayer(tab === 'Logo' ? 'logo' : asset.mime === 'image/svg+xml' ? 'svg' : 'image', {
          name: asset.name,
          assetId: asset.id,
          width: Math.min(500, asset.width),
          height: (Math.min(500, asset.width) * asset.height) / asset.width,
        }),
      );
    } catch (error) {
      useEditor.setState({ error: error instanceof Error ? error.message : 'Asset import failed' });
    }
  }
  async function removeTemplate(t: Template) {
    if (!confirm(`Delete custom template “${t.name}”? Your projects remain saved.`)) return;
    try {
      await deleteTemplate(t.id);
      onTemplatesChanged();
    } catch (error) {
      useEditor.setState({ error: error instanceof Error ? error.message : 'Delete failed' });
    }
  }
  async function renameTemplate(t: Template) {
    const name = prompt('Template name', t.name)?.trim();
    if (!name) return;
    try {
      await saveTemplate({ ...t, name });
      onTemplatesChanged();
    } catch (error) {
      useEditor.setState({ error: error instanceof Error ? error.message : 'Rename failed' });
    }
  }
  return (
    <>
      <nav className="tool-rail" aria-label="Editor library">
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            title={name}
            aria-label={name}
            onClick={() => {
              setTab(name);
              useEditor.setState({ mobilePanel: 'library' });
            }}
          >
            <Icon size={18} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      <aside className="library">
        <header>
          <button
            className="mobile-close"
            aria-label="Close library"
            onClick={() => useEditor.setState({ mobilePanel: null })}
          >
            ×
          </button>
          <span>YOUR CREATIVE SYSTEM</span>
          <h2>
            {tab}
            <span className="tiny-badge">
              {tab === 'Templates' ? '22 +' : tab === 'Layers' ? s.project.layers.length : '↗'}
            </span>
          </h2>
        </header>
        <div className="panel-body">
          {tab === 'Templates' && (
            <>
              <label className="search">
                <Search size={14} />
                <input
                  aria-label="Search templates"
                  placeholder="Find a composition…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="category-list">
                {['All', ...new Set([...builtInTemplates, ...custom].map((t) => t.category))].map(
                  (c) => (
                    <button
                      className={c === category ? 'selected' : ''}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ),
                )}
              </div>
              <div className="template-list">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={`template-card ${s.project.templateId === t.id ? 'current' : ''}`}
                  >
                    <button
                      aria-label={`Use ${t.name}`}
                      onClick={() => (t.custom ? onCustom(t) : onTemplate(t.id))}
                    >
                      <Thumbnail template={t} />
                      <span className="template-caption">
                        <strong>{t.name}</strong>
                        <span>
                          {t.project.width} × {t.project.height}
                        </span>
                      </span>
                    </button>
                    {t.custom && (
                      <div className="template-management">
                        <button onClick={() => void renameTemplate(t)}>Rename</button>
                        <button onClick={() => void removeTemplate(t)}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!templates.length && (
                <p className="hint">No templates match. Try another category.</p>
              )}
              <button className="full-button" onClick={onBatch}>
                Batch offer generator ↗
              </button>
            </>
          )}
          {tab === 'Text' && (
            <>
              <button
                className="primary full-button"
                onClick={() => addText('Your headline', 96, 800)}
              >
                <Plus size={16} /> Add text box
              </button>
              <p className="hint">
                Double-click text on the canvas to edit. Russian and English are supported.
              </p>
              {[
                ['Hero headline', 112, 850],
                ['Editorial title', 76, 750],
                ['Technical subtitle', 22, 400],
                ['Small metadata', 12, 400],
                ['Section number', 40, 500],
                ['Caption', 18, 400],
                ['Large offer number', 280, 800],
              ].map(([name, size, weight]) => (
                <button
                  className="text-preset"
                  key={name}
                  onClick={() =>
                    addText(
                      String(name),
                      Number(size),
                      Number(weight),
                      String(name).includes('metadata') || String(name).includes('Technical')
                        ? 'IBM Plex Mono'
                        : 'Inter',
                    )
                  }
                >
                  <span>{name}</span>
                  <span className="mono">{size}px ↗</span>
                </button>
              ))}
              <h3>Saved text styles</h3>
              {saved
                .filter((e) => e.layer.kind === 'text')
                .map((e) => (
                  <button className="full-button" key={e.layer.id} onClick={() => addSaved(e)}>
                    {e.layer.name}
                  </button>
                ))}
            </>
          )}
          {tab === 'Logo' && (
            <>
              <p className="hint">
                Original vector interpretation. The frame wears away; the identity stays.
              </p>
              <div className="logo-grid">
                {(['symbol', 'horizontal', 'vertical', 'wordmark', 'full'] as const).map(
                  (variant) => {
                    const l = createLayer('logo', {
                      logoVariant: variant,
                      width: variant === 'horizontal' || variant === 'wordmark' ? 420 : 220,
                      height:
                        variant === 'horizontal'
                          ? 110
                          : variant === 'wordmark'
                            ? 90
                            : variant === 'symbol'
                              ? 220
                              : 300,
                    });
                    return (
                      <button key={variant} onClick={() => s.add(l)}>
                        <img src={svgData(logoSvg(l))} alt={variant + ' logo'} />
                        <span>{variant}</span>
                      </button>
                    );
                  },
                )}
              </div>
              <button className="full-button" onClick={() => input.current?.click()}>
                <Upload size={15} /> Upload replacement SVG / PNG
              </button>
              <h3>Saved logo variants</h3>
              {saved
                .filter((e) => e.layer.kind === 'logo')
                .map((e) => (
                  <button className="full-button" key={e.layer.id} onClick={() => addSaved(e)}>
                    {e.layer.name}
                  </button>
                ))}
              {!saved.some((e) => e.layer.kind === 'logo') && (
                <p className="hint">Select a logo and save its variant from the inspector.</p>
              )}
            </>
          )}
          {tab === 'Elements' && (
            <>
              <div className="element-grid">
                {(
                  [
                    'rectangle',
                    'circle',
                    'crosshair',
                    'grid',
                    'corners',
                    'dots',
                    'registration',
                    'fragments',
                  ] as const
                ).map((shape) => (
                  <button
                    key={shape}
                    onClick={() =>
                      s.add(
                        createLayer('shape', {
                          name: shape.toUpperCase(),
                          shape,
                          width: shape === 'grid' ? 600 : 180,
                          height: shape === 'grid' ? 400 : 180,
                          opacity: shape === 'grid' ? 0.25 : 1,
                        }),
                      )
                    }
                  >
                    <span>
                      {shape === 'circle'
                        ? '◯'
                        : shape === 'crosshair'
                          ? '+'
                          : shape === 'grid'
                            ? '▦'
                            : shape === 'dots'
                              ? '⠿'
                              : shape === 'corners'
                                ? '⌜⌟'
                                : shape === 'fragments'
                                  ? '◩'
                                  : '□'}
                    </span>
                    {shape}
                  </button>
                ))}
              </div>
              <button
                className="full-button"
                onClick={() =>
                  s.add(
                    createLayer('line', {
                      name: 'HAIRLINE DIVIDER',
                      width: 600,
                      height: 4,
                      strokeWidth: 1,
                    }),
                  )
                }
              >
                Add thin divider
              </button>
              <button
                className="full-button"
                onClick={() =>
                  s.add(
                    createLayer('frame', {
                      name: 'FRAME',
                      width: 500,
                      height: 340,
                      strokeWidth: 2,
                    }),
                  )
                }
              >
                Add frame
              </button>
            </>
          )}
          {tab === 'Cracks' && (
            <>
              <p className="hint">
                Seeded, branching vector fractures. Every parameter remains editable.
              </p>
              {crackPresets.map((preset, i) => (
                <button
                  className="crack-preset"
                  key={preset}
                  onClick={() => {
                    const l = createLayer('crack', { name: preset, width: 600, height: 400 });
                    l.effect = { ...l.effect, preset, seed: 418 + i * 57 };
                    s.add(l);
                  }}
                >
                  <span className="mono">0{i + 1}</span>
                  <span>{preset}</span>
                  <Plus size={14} />
                </button>
              ))}
            </>
          )}
          {(tab === 'Textures' || tab === 'Scratches') && (
            <>
              <p className="hint">
                Independent effect layers. Move, blend or clip them to a shape.
              </p>
              {(tab === 'Scratches' ? ['scratch'] : ['grain', 'erosion', 'texture', 'scratch']).map(
                (kind) => (
                  <button
                    className="full-button"
                    key={kind}
                    onClick={() => {
                      if (
                        kind === 'grain' ||
                        kind === 'erosion' ||
                        kind === 'texture' ||
                        kind === 'scratch'
                      )
                        s.add(
                          createLayer(kind, {
                            name: kind.toUpperCase(),
                            width: s.project.width,
                            height: s.project.height,
                            x: 0,
                            y: 0,
                          }),
                        );
                    }}
                  >
                    <Plus size={15} /> Add {kind}
                  </button>
                ),
              )}
              <button className="full-button" onClick={() => useEditor.setState({ tool: 'brush' })}>
                Paint your own damage ↗
              </button>
            </>
          )}
          {tab === 'Backgrounds' && (
            <>
              <div className="surface-preview">
                <span>
                  MATERIAL
                  <br />
                  IS MEMORY.
                </span>
              </div>
              <p className="hint">
                Select the artboard to change its material, damage, grain and seed. Lock any
                parameter to retain it during randomization.
              </p>
              <button
                className="full-button"
                onClick={() => {
                  s.select([]);
                  useEditor.setState({ tool: 'select' });
                }}
              >
                Edit surface properties ↗
              </button>
              <button className="full-button" onClick={() => useEditor.setState({ tool: 'brush' })}>
                Paint damage
              </button>
            </>
          )}
          {tab === 'Assets' && (
            <>
              <button className="full-button" onClick={() => input.current?.click()}>
                <Upload size={16} /> Upload artwork
              </button>
              <p className="hint">
                SVG, PNG, WebP or JPEG · 8 MB max. Images are converted to grayscale. Drag a file
                onto the canvas.
              </p>
              <div className="asset-grid">
                {s.project.assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() =>
                      s.add(
                        createLayer(asset.mime === 'image/svg+xml' ? 'svg' : 'image', {
                          name: asset.name,
                          assetId: asset.id,
                          width: 400,
                          height: (400 * asset.height) / asset.width,
                        }),
                      )
                    }
                  >
                    <img src={asset.data} alt={asset.name} />
                    <span>{asset.name}</span>
                  </button>
                ))}
              </div>
              {!s.project.assets.length && (
                <p className="empty-note">Your uploaded assets will appear here.</p>
              )}
            </>
          )}
          {tab === 'Layers' && (
            <>
              <div className="layer-toolbar">
                <button title="Group selection" onClick={s.group}>
                  Group
                </button>
                <button title="Ungroup selection" onClick={s.ungroup}>
                  Ungroup
                </button>
                <button title="Duplicate selected layers" onClick={s.duplicate}>
                  <Copy size={14} />
                </button>
                <button title="Delete selected layers" onClick={s.remove}>
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="hint">
                Top layer prints last. Drag to reorder; Shift-click to select several.
              </p>
              <div className="layers-list">
                {[...s.project.layers].reverse().map((layer) => (
                  <LayerRow key={layer.id} layer={layer} />
                ))}
              </div>
              <button className="surface-row" onClick={() => s.select([])}>
                <span
                  className="surface-swatch"
                  style={{ background: s.project.background.color }}
                />
                Surface / {s.project.background.material}
                <LockKeyhole size={12} />
              </button>
            </>
          )}
          <input
            hidden
            ref={input}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </div>
        <footer className="library-footer">
          <span className="status-dot" /> LOCAL-FIRST. ENTIRELY YOURS.
        </footer>
      </aside>
    </>
  );
}
function LayerRow({ layer, depth = 0 }: { layer: Layer; depth?: number }) {
  const s = useEditor();
  return (
    <>
      <div
        className={`layer-row ${s.selection.includes(layer.id) ? 'selected' : ''}`}
        draggable={!depth}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', layer.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          s.reorder(
            e.dataTransfer.getData('text/plain'),
            s.project.layers.findIndex((l) => l.id === layer.id),
          );
        }}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <GripVertical size={12} />
        <button
          className="layer-name"
          onClick={(e) =>
            s.select(e.shiftKey ? [...new Set([...s.selection, layer.id])] : [layer.id])
          }
        >
          <span>{layer.kind === 'text' ? 'T' : layer.kind === 'group' ? '▦' : '◇'}</span>
          {layer.name}
        </button>
        <button
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={() => s.patchLayer(layer.id, { visible: !layer.visible })}
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={() => s.patchLayer(layer.id, { locked: !layer.locked })}
        >
          {layer.locked ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}
        </button>
      </div>
      {layer.children.map((child) => (
        <LayerRow key={child.id} layer={child} depth={depth + 1} />
      ))}
    </>
  );
}
