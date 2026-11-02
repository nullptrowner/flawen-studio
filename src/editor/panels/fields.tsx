import type { ReactNode } from 'react';
export function NumberField({
  label,
  value,
  onChange,
  min = -16384,
  max = 16384,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  extra,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  extra?: ReactNode;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        {extra}
        <output>{Math.round(value * 100) / 100}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="color-field">
      <span>{label}</span>
      <div className="swatches">
        {['#ffffff', '#f5f5f5', '#bdbdbd', '#777777', '#333333', '#111111', '#000000'].map(
          (color) => (
            <button
              key={color}
              title={color}
              aria-label={`${label} ${color}`}
              className={value === color ? 'selected' : ''}
              onClick={() => onChange(color)}
              style={{ background: color }}
            />
          ),
        )}
      </div>
    </div>
  );
}
