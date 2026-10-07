'use client';

import { useState } from 'react';
import { Fence, Leaf, Tractor } from 'lucide-react';
import { defaultFarmLayoutOptions, type FarmLayoutOptions, type FarmLayoutPreset } from './farm-layout';
import styles from './FarmBuilderControls.module.css';

const presets: readonly { id: FarmLayoutPreset; label: string; detail: string }[] = [
  { id: 'homestead', label: 'Homestead', detail: 'A pen and kitchen garden' },
  { id: 'ranch', label: 'Livestock ranch', detail: 'Four sheltered pens' },
  { id: 'market-garden', label: 'Market garden', detail: 'Eight growing beds' },
  { id: 'mixed', label: 'Mixed farm', detail: 'Pens, crops and storage' },
];

export type FarmBuilderControlsProps = Readonly<{
  busy?: boolean;
  onCreate: (options: FarmLayoutOptions) => void;
}>;

export function FarmBuilderControls({ busy = false, onCreate }: FarmBuilderControlsProps) {
  const [options, setOptions] = useState<FarmLayoutOptions>(() => defaultFarmLayoutOptions());
  const change = (patch: Partial<FarmLayoutOptions>) => setOptions(current => ({ ...current, ...patch }));
  const empty = options.shelterCount + options.gardenCount === 0;
  return <div className={styles.builder} data-farm-builder>
    <div className={styles.intro}><Tractor size={17} aria-hidden="true"/><p>Design a farm<small>Choose a layout, then adjust it before building.</small></p></div>
    <div className={styles.presets} aria-label="Farm layouts">
      {presets.map(preset => <button key={preset.id} type="button" disabled={busy} aria-pressed={options.preset === preset.id} onClick={() => setOptions(defaultFarmLayoutOptions(preset.id))}><strong>{preset.label}</strong><small>{preset.detail}</small></button>)}
    </div>
    <fieldset disabled={busy} className={styles.options}>
      <legend className={styles.visuallyHidden}>Customize farm layout</legend>
      <label>Farm size<select aria-label="Farm size" value={options.size} onChange={event => change({ size: event.target.value as FarmLayoutOptions['size'] })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="estate">Estate</option></select></label>
      <label>Building material<select aria-label="Farm building material" value={options.material} onChange={event => change({ material: event.target.value as FarmLayoutOptions['material'] })}><option value="timber">Timber</option><option value="stone">Stone</option></select></label>
      <label className={styles.quantity}><span><Fence size={14} aria-hidden="true"/>Sheltered pens <output>{options.shelterCount}</output></span><input aria-label="Farm sheltered pens" type="range" min={0} max={6} step={1} value={options.shelterCount} onChange={event => change({ shelterCount: Number(event.target.value) })}/></label>
      <label className={styles.quantity}><span><Leaf size={14} aria-hidden="true"/>Crop beds <output>{options.gardenCount}</output></span><input aria-label="Farm crop beds" type="range" min={0} max={12} step={1} value={options.gardenCount} onChange={event => change({ gardenCount: Number(event.target.value) })}/></label>
      <label className={styles.check}><input type="checkbox" checked={options.storage} onChange={event => change({ storage: event.target.checked })}/>Supply storage</label>
      <label className={styles.check}><input type="checkbox" checked={options.paths} onChange={event => change({ paths: event.target.checked })}/>Connecting paths</label>
    </fieldset>
    <p className={styles.summary} aria-live="polite">{options.shelterCount ? `Space for up to ${options.shelterCount * 4} livestock after construction.` : 'A crop farm without livestock pens.'} {options.gardenCount ? 'Crop beds start empty; add seeds and water to grow produce.' : ''}</p>
    <button className={styles.prepare} type="button" disabled={busy || empty} onClick={() => onCreate(options)}><Tractor size={15} aria-hidden="true"/>Preview farm</button>
    {empty ? <small role="status">Add at least one pen or crop bed.</small> : <small>The preview shows the materials and creature skills needed.</small>}
  </div>;
}
