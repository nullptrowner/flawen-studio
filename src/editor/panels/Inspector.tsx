import { useState } from 'react';
import {
  FlipHorizontal2,
  FlipVertical2,
  LockKeyhole,
  UnlockKeyhole,
  Shuffle,
  Trash2,
  Copy,
  ArrowDown,
  ArrowUp,
  Group,
  Ungroup,
} from 'lucide-react';
import { useEditor, findLayer } from '../store';
import {
  type Layer,
  type Background,
  fonts,
  materials,
  crackPresets,
  brushModes,
} from '../../types/project';
import { NumberField, SelectField, Slider, ColorField } from './fields';
import { saveLibrary } from '../../persistence/database';
import { createLibraryEntry } from '../../persistence/library';
const seed = () => Math.floor(Math.random() * 2147483647);
const effectKeys = [
  'wear',
  'grain',
  'cracks',
  'scratches',
  'erosion',
  'edge',
  'contrast',
  'dust',
  'roughness',
] as const;
export function Inspector() {
  const s = useEditor(),
    l = s.selection.length === 1 ? findLayer(s.project.layers, s.selection[0]) : undefined;
  const [ratio, setRatio] = useState(true);
  const patch = (p: Partial<Layer>, key?: string) =>
    l && s.patchLayer(l.id, p, key ? l.id + key : undefined);
  const effect = (p: Partial<Layer['effect']>, key = 'effect') =>
    l && patch({ effect: { ...l.effect, ...p } }, key);
  async function saveVariant() {
    if (!l) return;
    try {
      await saveLibrary(
        `${l.kind}:${crypto.randomUUID()}`,
        createLibraryEntry({ ...l, name: l.name + ' preset' }, s.project),
      );
      useEditor.setState({ status: 'Saved to your library' });
    } catch (e) {
      useEditor.setState({ error: e instanceof Error ? e.message : 'Preset save failed' });
    }
  }
  if (s.tool === 'brush')
    return (
      <aside className="inspector">
        <header>
          <button
            className="mobile-close"
            aria-label="Close inspector"
            onClick={() => useEditor.setState({ mobilePanel: null })}
          >
            ×
          </button>
          <span>DIRECT INTERVENTION</span>
          <h2>Damage brush</h2>
        </header>
        <div className="panel-body">
          <p className="hint">
            Paint on the surface. Restore removes previous damage without touching your text or
            logo.
          </p>
          <SelectField
            label="Brush mode"
            value={s.brush.mode}
            options={brushModes}
            onChange={(mode) => {
              const value = brushModes.find((m) => m === mode);
              if (value) useEditor.setState({ brush: { ...s.brush, mode: value } });
            }}
          />
          {(['size', 'hardness', 'strength', 'spacing', 'opacity'] as const).map((key) => (
            <Slider
              key={key}
              label={`Brush ${key}`}
              value={s.brush[key]}
              min={key === 'opacity' ? 0 : 1}
              max={key === 'size' ? 400 : key === 'opacity' ? 1 : 100}
              step={key === 'opacity' ? 0.01 : 1}
              onChange={(value) => useEditor.setState({ brush: { ...s.brush, [key]: value } })}
            />
          ))}
          <h3>Editable strokes · {s.project.strokes.length}</h3>
          <div className="strokes">
            {s.project.strokes.map((stroke, i) => (
              <div className="stroke-row" key={stroke.id}>
                <span>
                  {String(i + 1).padStart(2, '0')} {stroke.mode}
                </span>
                <button
                  title="Delete stroke"
                  onClick={() =>
                    s.change('Stroke removed', (p) => {
                      p.strokes = p.strokes.filter((a) => a.id !== stroke.id);
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
                <input
                  aria-label={`Stroke ${i + 1} strength`}
                  type="range"
                  min="0"
                  max="100"
                  value={stroke.strength}
                  onChange={(e) =>
                    s.change(
                      'Stroke adjusted',
                      (p) => {
                        const current = p.strokes.find((a) => a.id === stroke.id);
                        if (current) current.strength = Number(e.target.value);
                      },
                      stroke.id,
                    )
                  }
                />
              </div>
            ))}
          </div>
          <button
            className="full-button"
            disabled={!s.project.strokes.length}
            onClick={() =>
              s.change('Brush strokes cleared', (p) => {
                p.strokes = [];
              })
            }
          >
            Clear painted damage
          </button>
          <button className="full-button" onClick={() => useEditor.setState({ tool: 'select' })}>
            Return to selection
          </button>
        </div>
      </aside>
    );
  if (!l)
    return (
      <aside className="inspector">
        <header>
          <button
            className="mobile-close"
            aria-label="Close inspector"
            onClick={() => useEditor.setState({ mobilePanel: null })}
          >
            ×
          </button>
          <span>{s.selection.length ? 'MULTIPLE OBJECTS' : 'ARTBOARD / MATERIAL'}</span>
          <h2>
            {s.selection.length ? `${s.selection.length} layers selected` : 'Surface properties'}
          </h2>
        </header>
        <div className="panel-body">
          {s.selection.length > 1 && (
            <button className="full-button" onClick={s.group}>
              <Group size={15} /> Group selection
            </button>
          )}
          <BackgroundControls />
        </div>
      </aside>
    );
  const size = (key: 'width' | 'height', value: number) =>
    patch(
      ratio && l.kind !== 'text'
        ? {
            width: key === 'width' ? value : (l.width * value) / l.height,
            height: key === 'height' ? value : (l.height * value) / l.width,
          }
        : { [key]: value },
      key,
    );
  return (
    <aside className="inspector">
      <header>
        <button
          className="mobile-close"
          aria-label="Close inspector"
          onClick={() => useEditor.setState({ mobilePanel: null })}
        >
          ×
        </button>
        <span>{l.kind.toUpperCase()} / SELECTED</span>
        <h2>Object properties</h2>
      </header>
      <div className="panel-body">
        <label className="field">
          <span>Layer name</span>
          <input
            value={l.name}
            onChange={(e) => patch({ name: e.target.value || 'Layer' }, 'name')}
          />
        </label>
        <div className="inspector-actions">
          <button title="Duplicate selected" onClick={s.duplicate}>
            <Copy size={16} />
          </button>
          <button title="Delete selected" onClick={s.remove}>
            <Trash2 size={16} />
          </button>
          <button title="Flip horizontally" onClick={() => patch({ flipX: !l.flipX })}>
            <FlipHorizontal2 size={16} />
          </button>
          <button title="Flip vertically" onClick={() => patch({ flipY: !l.flipY })}>
            <FlipVertical2 size={16} />
          </button>
          <button
            title="Move forward"
            onClick={() => s.reorder(l.id, s.project.layers.findIndex((a) => a.id === l.id) + 1)}
          >
            <ArrowUp size={16} />
          </button>
          <button title="Move to back" onClick={() => s.reorder(l.id, 0)}>
            <ArrowDown size={16} />
          </button>
        </div>
        <h3>Transform</h3>
        <div className="field-grid">
          <NumberField label="X" value={l.x} onChange={(x) => patch({ x }, 'x')} />
          <NumberField label="Y" value={l.y} onChange={(y) => patch({ y }, 'y')} />
          <NumberField label="Width" min={1} value={l.width} onChange={(v) => size('width', v)} />
          <NumberField
            label="Height"
            min={1}
            value={l.height}
            onChange={(v) => size('height', v)}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={ratio} onChange={(e) => setRatio(e.target.checked)} />{' '}
          Preserve aspect ratio
        </label>
        <NumberField
          label="Rotation"
          min={-360}
          max={360}
          value={l.rotation}
          onChange={(rotation) => patch({ rotation }, 'rotation')}
        />
        <Slider
          label="Opacity"
          value={l.opacity}
          max={1}
          step={0.01}
          onChange={(opacity) => patch({ opacity }, 'opacity')}
        />
        <ColorField label="Ink" value={l.color} onChange={(color) => patch({ color })} />
        {l.kind === 'text' && (
          <>
            <h3>Typography</h3>
            <label className="field">
              <span>Text content</span>
              <textarea
                aria-label="Text content"
                rows={4}
                value={l.text}
                onChange={(e) => patch({ text: e.target.value }, 'text')}
              />
            </label>
            <SelectField
              label="Font family"
              value={l.fontFamily}
              options={fonts}
              onChange={(family) => {
                const fontFamily = fonts.find((f) => f === family);
                if (fontFamily) patch({ fontFamily });
              }}
            />
            {l.fontFamily === 'Space Grotesk' && /[А-Яа-яЁё]/.test(l.text) && (
              <p className="hint">
                Cyrillic uses Inter; Space Grotesk does not include Cyrillic glyphs.
              </p>
            )}
            <div className="field-grid">
              <NumberField
                label="Font size"
                min={4}
                max={2000}
                value={l.fontSize}
                onChange={(fontSize) => patch({ fontSize }, 'fontSize')}
              />
              <NumberField
                label="Weight"
                min={100}
                max={900}
                step={100}
                value={l.fontWeight}
                onChange={(fontWeight) => patch({ fontWeight }, 'weight')}
              />
              <NumberField
                label="Line height"
                min={0.5}
                max={3}
                step={0.05}
                value={l.lineHeight}
                onChange={(lineHeight) => patch({ lineHeight }, 'lineHeight')}
              />
              <NumberField
                label="Tracking"
                min={-300}
                max={2000}
                value={l.letterSpacing}
                onChange={(letterSpacing) => patch({ letterSpacing }, 'tracking')}
              />
            </div>
            <SelectField
              label="Alignment"
              value={l.align}
              options={['left', 'center', 'right', 'justify']}
              onChange={(align) => {
                if (
                  align === 'left' ||
                  align === 'center' ||
                  align === 'right' ||
                  align === 'justify'
                )
                  patch({ align });
              }}
            />
            <SelectField
              label="Vertical alignment"
              value={l.verticalAlign}
              options={['top', 'middle', 'bottom']}
              onChange={(verticalAlign) => {
                if (
                  verticalAlign === 'top' ||
                  verticalAlign === 'middle' ||
                  verticalAlign === 'bottom'
                )
                  patch({ verticalAlign });
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={l.uppercase}
                onChange={(e) => patch({ uppercase: e.target.checked })}
              />{' '}
              Uppercase display
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={l.outline}
                onChange={(e) => patch({ outline: e.target.checked })}
              />{' '}
              Outlined type
            </label>
            <button className="full-button" onClick={() => void saveVariant()}>
              Save text style
            </button>
          </>
        )}
        {l.kind === 'logo' && (
          <>
            <h3>Identity</h3>
            <SelectField
              label="Logo variant"
              value={l.logoVariant}
              options={['symbol', 'wordmark', 'horizontal', 'vertical', 'full']}
              onChange={(logoVariant) => {
                if (
                  logoVariant === 'symbol' ||
                  logoVariant === 'wordmark' ||
                  logoVariant === 'horizontal' ||
                  logoVariant === 'vertical' ||
                  logoVariant === 'full'
                )
                  patch({ logoVariant });
              }}
            />
            <Slider
              label="Logo distress"
              value={l.distress}
              onChange={(distress) => patch({ distress }, 'distress')}
            />
            {l.assetId && (
              <p className="hint">
                Uploaded master retained. Variant and distress controls apply to the built-in vector
                logo.
              </p>
            )}
            <button className="full-button" onClick={() => void saveVariant()}>
              Save logo variant
            </button>
          </>
        )}
        {l.kind === 'crack' && (
          <>
            <h3>Fracture geometry</h3>
            <SelectField
              label="Crack type"
              value={l.effect.preset}
              options={crackPresets}
              onChange={(preset) => {
                const value = crackPresets.find((p) => p === preset);
                if (value) effect({ preset: value });
              }}
            />
            <NumberField
              label="Length"
              min={10}
              max={8192}
              value={l.effect.length}
              onChange={(length) => effect({ length })}
            />
            <NumberField
              label="Thickness"
              min={0.1}
              max={40}
              step={0.1}
              value={l.effect.thickness}
              onChange={(thickness) => effect({ thickness })}
            />
            <Slider
              label="Branch probability"
              value={l.effect.branching}
              onChange={(branching) => effect({ branching })}
            />
            <NumberField
              label="Branch count"
              min={0}
              max={40}
              value={l.effect.branchCount}
              onChange={(branchCount) => effect({ branchCount })}
            />
            <Slider
              label="Irregularity"
              value={l.effect.irregularity}
              onChange={(irregularity) => effect({ irregularity })}
            />
            <NumberField
              label="Direction"
              min={-360}
              max={360}
              value={l.effect.direction}
              onChange={(direction) => effect({ direction })}
            />
            <button
              className="full-button"
              onClick={() => effect({ direction: Math.round(Math.random() * 360) })}
            >
              Randomize direction
            </button>
          </>
        )}
        {['crack', 'scratch', 'grain', 'erosion', 'texture'].includes(l.kind) && (
          <>
            <Slider
              label="Effect intensity"
              value={l.effect.intensity}
              onChange={(intensity) => effect({ intensity })}
            />
            <NumberField
              label="Seed"
              min={0}
              max={2147483647}
              value={l.effect.seed}
              onChange={(seed) => effect({ seed })}
            />
            <button className="full-button" onClick={() => effect({ seed: seed() })}>
              <Shuffle size={15} /> Regenerate
            </button>
            <label className="field">
              <span>Clip to shape bounds</span>
              <select
                value={l.clipId ?? ''}
                onChange={(e) => patch({ clipId: e.target.value || null })}
              >
                <option value="">Artboard</option>
                {s.project.layers
                  .filter((a) => ['shape', 'frame'].includes(a.kind) && a.id !== l.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {['shape', 'frame', 'line'].includes(l.kind) && (
          <>
            <NumberField
              label="Stroke width"
              min={0}
              max={100}
              value={l.strokeWidth}
              onChange={(strokeWidth) => patch({ strokeWidth }, 'stroke')}
            />
            <ColorField label="Stroke" value={l.stroke} onChange={(stroke) => patch({ stroke })} />
          </>
        )}
        {l.kind === 'group' && (
          <button className="full-button" onClick={s.ungroup}>
            <Ungroup size={16} /> Ungroup layers
          </button>
        )}
        <p className="hint">
          Changes autosave on this device. Export a project JSON to move your artwork elsewhere.
        </p>
      </div>
    </aside>
  );
}
export function BackgroundControls() {
  const s = useEditor(),
    b = s.project.background;
  const [scope, setScope] = useState('Full background');
  const patch = (patch: Partial<Background>, key = 'background') =>
    s.change(
      'Surface updated',
      (p) => {
        Object.assign(p.background, patch);
      },
      key,
    );
  function randomize() {
    s.change('Surface randomized', (p) => {
      const bg = p.background;
      const keys =
        scope === 'Full background'
          ? effectKeys
          : effectKeys.filter((k) => k === scope.toLowerCase().replace('only ', ''));
      for (const key of keys)
        if (!bg.locked.includes(key)) bg[key] = Math.floor(Math.random() * 75);
      if (scope === 'Full background' && !bg.locked.includes('seed')) bg.seed = seed();
      for (const key of ['cracks', 'scratches', 'erosion', 'grain'] as const)
        if (
          (scope === 'Full background' || scope.toLowerCase().includes(key)) &&
          !bg.locked.includes(key)
        )
          bg.seeds[key] = seed();
    });
  }
  return (
    <>
      <div className="material-states">
        {['PRISTINE', 'MICRO-WEAR', 'WORN', 'DAMAGED', 'FRACTURED', 'DESTROYED'].map((label, i) => (
          <button
            key={label}
            onClick={() =>
              patch({
                wear: i * 20,
                grain: i * 14,
                cracks: Math.max(0, i - 1) * 22,
                scratches: i * 16,
                erosion: Math.max(0, i - 1) * 24,
                edge: i * 18,
                dust: i * 10,
                roughness: i * 18,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <ColorField label="Base color" value={b.color} onChange={(color) => patch({ color })} />
      <SelectField
        label="Material"
        value={b.material}
        options={materials}
        onChange={(material) => {
          const value = materials.find((m) => m === material);
          if (value)
            patch({ material: value, ...(value === 'Black material' ? { color: '#111111' } : {}) });
        }}
      />
      {effectKeys.map((key) => (
        <div className="lock-slider" key={key}>
          <Slider
            label={key[0].toUpperCase() + key.slice(1)}
            value={b[key]}
            onChange={(value) => patch({ [key]: value }, key)}
          />
          <button
            title={`Lock ${key} during randomization`}
            aria-pressed={b.locked.includes(key)}
            onClick={() =>
              patch({
                locked: b.locked.includes(key)
                  ? b.locked.filter((k) => k !== key)
                  : [...b.locked, key],
              })
            }
          >
            {b.locked.includes(key) ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}
          </button>
        </div>
      ))}
      <NumberField
        label="Surface seed"
        min={0}
        max={2147483647}
        value={b.seed}
        onChange={(seed) => patch({ seed })}
      />
      <SelectField
        label="Randomize"
        value={scope}
        options={['Full background', 'Only cracks', 'Only scratches', 'Only erosion', 'Only grain']}
        onChange={setScope}
      />
      <button className="full-button" onClick={randomize}>
        <Shuffle size={15} /> Randomize material
      </button>
      <button className="full-button" onClick={() => useEditor.setState({ tool: 'brush' })}>
        Paint damage by hand ↗
      </button>
    </>
  );
}
