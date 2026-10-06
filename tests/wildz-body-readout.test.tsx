import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildsBodyReadout } from '../src/features/play/command-center/WildsBodyReadout';
import { createPlayerBreaths, playerBreathReadout, advancePlayerBreaths } from '../src/features/play/player-breath-energy';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';

test('body details expose live readiness, limiting fuel, current mode and clock breaths', () => {
 const kai=Number(KAI_N_DAY_MICRO)*100;
 const body=playerBreathReadout(advancePlayerBreaths(createPlayerBreaths(kai,7.25),kai,'camp'));
 const html=renderToStaticMarkup(<WildsBodyReadout body={body} />);
 assert.match(html,/role="progressbar"/);
 assert.match(html,/aria-valuenow="7.2"/);
 assert.match(html,/Resting at camp/);
 assert.match(html,/Fuel currently sets your readiness/);
 assert.match(html,/breaths left this Kai day/);
 assert.match(html,/including time away/);
 assert.match(html,/Strain/);assert.match(html,/Fatigue/);
 const later=playerBreathReadout(advancePlayerBreaths(bodyAsSource(kai),kai+100_000_000));
 assert.ok(later.energyPercent>body.energyPercent);
 assert.ok(later.remainingDayBreaths<body.remainingDayBreaths);
 assert.ok(Math.abs(body.energyPercent-7.25)<1e-12);
 function bodyAsSource(time:number){return advancePlayerBreaths(createPlayerBreaths(time,7.25),time,'camp');}
});
