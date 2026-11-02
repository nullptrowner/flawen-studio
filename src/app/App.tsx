import { useEffect, useState } from 'react';
import {
  Undo2,
  Redo2,
  Download,
  Save,
  Maximize,
  MousePointer2,
  Hand,
  Paintbrush,
  Grid2X2,
  Scan,
  Eye,
  Settings2,
  FolderOpen,
  Plus,
  Layers,
  PanelLeftClose,
} from 'lucide-react';
import { useEditor } from '../editor/store';
import { Workspace } from '../editor/canvas/Workspace';
import { Library } from '../editor/panels/Library';
import { Inspector } from '../editor/panels/Inspector';
import {
  ExportDialog,
  BatchDialog,
  ProjectsDialog,
  SettingsDialog,
} from '../editor/panels/Dialogs';
import { useWorkspace, persistCurrent } from '../persistence/useWorkspace';
import { createFromTemplate } from '../templates';
import { saveTemplate } from '../persistence/database';
import { createProject, type Template } from '../types/project';
import { projectJson } from '../persistence/portable';
import { download } from '../utils/assets';
export function App() {
  const s = useEditor(),
    workspace = useWorkspace();
  const [dialog, setDialog] = useState<'export' | 'batch' | 'projects' | 'settings' | null>(null),
    [locale, setLocale] = useState<'en' | 'ru'>('en'),
    [compact, setCompact] = useState(false);
  const report = (e: unknown) =>
    useEditor.setState({
      error: e instanceof Error ? e.message : 'Operation failed. Your current artwork is retained.',
    });
  async function template(id: string) {
    try {
      await workspace.open(createFromTemplate(id, locale));
    } catch (e) {
      report(e);
    }
  }
  async function custom(t: Template) {
    try {
      await workspace.open({
        ...structuredClone(t.project),
        id: crypto.randomUUID(),
        name: t.name,
        templateId: t.id,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      report(e);
    }
  }
  async function saveAsTemplate() {
    const name = prompt('Name your custom template', s.project.name)?.trim();
    if (!name) return;
    try {
      await saveTemplate({
        id: 'custom-' + crypto.randomUUID(),
        name,
        category: 'Custom',
        description: 'Your saved composition',
        project: structuredClone(s.project),
        custom: true,
      });
      workspace.refreshTemplates();
      useEditor.setState({ status: 'Custom template saved' });
    } catch (e) {
      report(e);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persistCurrent().catch(report);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <div
      className={`studio theme-${s.theme} ${s.preview ? 'is-preview' : ''} ${compact ? 'compact' : ''} ${s.mobilePanel ? 'mobile-' + s.mobilePanel : ''}`}
    >
      <header className="topbar">
        <a
          className="studio-brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="FLAWEN STUDIO"
        >
          <span className="brand-icon">F</span>
          <span>
            FLAWEN<span className="studio-word">STUDIO</span>
          </span>
          <span className="version">01</span>
        </a>
        <span className="toolbar-divider" />
        <button
          className="project-menu"
          title="Open projects"
          onClick={() => setDialog('projects')}
        >
          <FolderOpen size={16} />
          <span>{s.project.name}</span>
          <span className="chevron">⌄</span>
        </button>
        <span className="save-state">
          <i className={s.revision === s.savedRevision ? 'saved' : ''} />
          {s.revision === s.savedRevision ? 'Saved on device' : 'Unsaved changes'}
        </span>
        <div className="top-actions">
          <button
            title="Save project · ⌘S"
            aria-label="Save project"
            onClick={() => void persistCurrent().catch(report)}
          >
            <Save size={17} />
          </button>
          <button title="Undo · ⌘Z" aria-label="Undo" disabled={!s.past.length} onClick={s.undo}>
            <Undo2 size={18} />
          </button>
          <button title="Redo · ⌘⇧Z" aria-label="Redo" disabled={!s.future.length} onClick={s.redo}>
            <Redo2 size={18} />
          </button>
          <span className="toolbar-divider" />
          <button
            title="Preview artwork"
            aria-pressed={s.preview}
            onClick={() =>
              useEditor.setState({ preview: !s.preview, fitRequest: s.fitRequest + 1 })
            }
          >
            <Eye size={17} />
            <span>Preview</span>
          </button>
          <button
            title="Project settings"
            aria-label="Project settings"
            onClick={() => setDialog('settings')}
          >
            <Settings2 size={17} />
          </button>
          <button className="export-button" onClick={() => setDialog('export')}>
            <Download size={15} />
            Export<span>↗</span>
          </button>
        </div>
      </header>
      <div className="editor-shell">
        <Library
          custom={workspace.custom}
          onTemplate={(id) => void template(id)}
          onCustom={(t) => void custom(t)}
          onTemplatesChanged={workspace.refreshTemplates}
          onBatch={() => setDialog('batch')}
        />
        <main className="stage">
          <div className="stage-heading">
            <div>
              <span className="mono">ARTBOARD 01</span>
              <span>{s.project.name}</span>
              <span className="dimension-badge">
                {s.project.width} × {s.project.height}
              </span>
            </div>
            <div className="stage-options">
              <button
                title="New blank project"
                onClick={() => void workspace.open(createProject()).catch(report)}
              >
                <Plus size={14} />
              </button>
              <button title="Save as custom template" onClick={() => void saveAsTemplate()}>
                <Layers size={15} />
              </button>
              <button
                title="Export editable JSON"
                onClick={() =>
                  download(
                    new Blob([projectJson(s.project)], { type: 'application/json' }),
                    'flawen-project.json',
                  )
                }
              >
                JSON
              </button>
              <button
                title="Reset composition to original template"
                onClick={() => {
                  if (
                    confirm(
                      'Reset creates a fresh template project. Your current artwork will be saved first.',
                    )
                  )
                    void template(
                      s.project.templateId.startsWith('custom-') ? 'news' : s.project.templateId,
                    );
                }}
              >
                Reset
              </button>
              <button
                title="Toggle side panels"
                onClick={() => {
                  if (innerWidth <= 800)
                    useEditor.setState({ mobilePanel: s.mobilePanel ? null : 'inspector' });
                  else setCompact(!compact);
                  useEditor.setState({ fitRequest: s.fitRequest + 1 });
                }}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
          </div>
          <Workspace />
          {!s.ready && <div className="loading-workspace">Opening your local studio…</div>}
          <div className="floating-tools">
            <button
              title="Select · V"
              aria-pressed={s.tool === 'select'}
              onClick={() => useEditor.setState({ tool: 'select' })}
            >
              <MousePointer2 size={17} />
            </button>
            <button
              title="Pan · Space"
              aria-pressed={s.tool === 'pan'}
              onClick={() => useEditor.setState({ tool: 'pan' })}
            >
              <Hand size={17} />
            </button>
            <button
              title="Damage brush · B"
              aria-pressed={s.tool === 'brush'}
              onClick={() => useEditor.setState({ tool: 'brush' })}
            >
              <Paintbrush size={17} />
            </button>
            <span />
            <button
              title="Safe area and rulers"
              aria-pressed={s.guides}
              onClick={() => useEditor.setState({ guides: !s.guides })}
            >
              <Scan size={17} />
            </button>
            <button
              title="Snap to 10px grid"
              aria-pressed={s.snap}
              onClick={() => useEditor.setState({ snap: !s.snap })}
            >
              <Grid2X2 size={17} />
            </button>
            <span />
            <button
              title="Zoom out"
              onClick={() => useEditor.setState({ zoom: Math.max(0.08, s.zoom / 1.2) })}
            >
              −
            </button>
            <button
              className="zoom-number"
              title="Actual size · 100%"
              onClick={() => useEditor.setState({ zoom: 1 })}
            >
              {Math.round(s.zoom * 100)}%
            </button>
            <button
              title="Zoom in"
              onClick={() => useEditor.setState({ zoom: Math.min(4, s.zoom * 1.2) })}
            >
              +
            </button>
            <button
              title="Fit artboard"
              onClick={() => useEditor.setState({ fitRequest: s.fitRequest + 1 })}
            >
              <Maximize size={16} />
            </button>
          </div>
        </main>
        <Inspector />
      </div>
      <footer className="statusbar">
        <span>
          <i /> {s.status}
        </span>
        <span className="motto">NOTHING STAYS FLAWLESS.</span>
        <div>
          <label>
            Template language{' '}
            <select
              aria-label="Template language"
              value={locale}
              onChange={(e) => setLocale(e.target.value === 'ru' ? 'ru' : 'en')}
            >
              <option value="en">EN</option>
              <option value="ru">RU</option>
            </select>
          </label>
          <span>{s.project.layers.length} layers</span>
          <span>LOCAL / PRIVATE</span>
        </div>
      </footer>
      {s.error && (
        <div className="error-toast" role="alert">
          <span>{s.error}</span>
          <button aria-label="Dismiss error" onClick={() => useEditor.setState({ error: '' })}>
            ×
          </button>
        </div>
      )}
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}{' '}
      {dialog === 'batch' && <BatchDialog onClose={() => setDialog(null)} />}{' '}
      {dialog === 'projects' && (
        <ProjectsDialog onClose={() => setDialog(null)} onOpen={workspace.open} />
      )}{' '}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
