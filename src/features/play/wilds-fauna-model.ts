import type { WildsAnimalSpecies } from './wilds-animal-ecology';
export type WildsFaunaPart = 'body' | 'limb' | 'tip';
export type WildsFaunaDraw = (shape: WildsFaunaPart, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, tilt?: number, roll?: number) => void;

/** Local anatomy faces +Z. One shared instanced batch per shape, with articulated joints. */
export function drawWildsFauna(species: WildsAnimalSpecies, gait: number, moving: boolean, grazing: boolean, part: WildsFaunaDraw) {
  const goat = species === 'meadow-goat', bird = species === 'ground-bird';
  const pace = moving ? Math.sin(gait) : 0;
  const hop = !goat && !bird && moving ? Math.max(0, Math.sin(gait)) * .07 : 0;
  const coat = goat ? '#b5a58a' : bird ? '#aa7845' : '#87735b';
  const body = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone = coat, tilt = 0, roll = 0) => part('body', x, y + hop, z, sx, sy, sz, tone, tilt, roll);
  const link = (shape: 'limb' | 'tip', a: [number, number, number], b: [number, number, number], width: number, tone: string) => {
    const dy = b[1] - a[1], dz = b[2] - a[2], dx = b[0] - a[0];
    part(shape, (a[0]+b[0])/2, (a[1]+b[1])/2+hop, (a[2]+b[2])/2,
      width, Math.hypot(dx,dy,dz), width, tone, Math.atan2(dz,dy), -Math.atan2(dx,Math.hypot(dy,dz)));
  };
  const headDrop = grazing ? (goat ? .27 : .13) : 0;
  if (goat) {
    body(0,.67,0,.23,.27,.46); // rib cage, shoulder, rump, belly
    body(0,.73,-.29,.24,.26,.25,'#a4957b');
    body(0,.77,.27,.19,.26,.23,'#b9aa90');
    body(0,.57,.02,.18,.14,.35,'#d0c2a7');
    body(0,.86-headDrop,.43,.12,.24,.14,'#cbbda1',-.4);
    body(0,1.04-headDrop,.52,.11,.16,.15,'#c7b89b',-.25);
    body(0,.98-headDrop,.65,.105,.085,.14,'#d6c6a8'); // muzzle, dark nose and beard
    body(0,.96-headDrop,.765,.075,.05,.018,'#403a30');
    part('tip',0,.84-headDrop,.66,.045,.14,.045,'#b6a58c',Math.PI);
    for (const side of [-1,1]) {
      body(side*.1,1.065-headDrop,.59,.022,.019,.013,'#2f291f');
      body(side*.105,1.066-headDrop,.602,.014,.009,.006,'#bfa057');
      body(side*.18,1.09-headDrop,.49,.12,.036,.055,'#b9a78e',.15,side*.28);
      body(side*.187,1.096-headDrop,.505,.072,.014,.035,'#9d7964',.15,side*.28);
      link('limb',[side*.07,1.15-headDrop,.47],[side*.085,1.29-headDrop,.39],.035,'#807459');
      link('tip',[side*.085,1.29-headDrop,.39],[side*.075,1.38-headDrop,.3],.028,'#6a6250');
      for (const front of [-1,1]) {
        const phase = moving ? Math.sin(gait + (side === front ? 0 : Math.PI)) : 0;
        const z = front*.28, kneeZ=z+phase*.1, footZ=z+phase*.15;
        const lift = moving ? Math.max(0,phase)*.075 : 0;
        link('limb',[side*.16,.67,z],[side*.17,.32,kneeZ],.045,coat);
        body(side*.17,.32,kneeZ,.042,.05,.045,'#b1a084');
        link('limb',[side*.17,.32,kneeZ],[side*.17,.075+lift,footZ],.028,'#b9a98d');
        body(side*.17,.055+lift,footZ+.012,.044,.055,.065,'#514b40');
      }
    }
    link('limb',[0,.84,-.42],[0,.96,-.53],.032,'#a18c70');
    body(0,.96,-.53,.035,.07,.045);
  } else if (bird) {
    const bob = moving ? Math.abs(pace)*.012 : 0;
    body(0,.3+bob,0,.145,.19,.23);
    body(0,.25+bob,.1,.13,.12,.14,'#d4b187');
    body(0,.47-headDrop,.16,.066,.135,.07,'#c0a581',-.2);
    body(0,.58-headDrop,.19,.078,.085,.09,'#c9b397');
    for (const side of [-1,1]) {
      body(side*.135,.32,-.02,.047,.12,.18,'#755033',-.15,side*.12);
      for (let feather=0;feather<3;feather++) body(side*(.14+feather*.012),.25+feather*.026,-.1,.012,.07,.115,'#8d6743',-.28);
      body(side*.07,.604-headDrop,.223,.012,.013,.007,'#24211a');
      const swing = moving ? Math.sin(gait+(side<0?Math.PI:0))*.06 : 0;
      link('limb',[side*.045,.21,.03],[side*.045,.08,.03+swing],.012,'#c79345');
      for (const toe of [-1,0,1]) link('limb',[side*.045,.04,.03+swing],[side*.045+toe*.021,.022,.1+swing],.006,'#b9863b');
    }
    part('tip',0,.565-headDrop,.292,.028,.072,.03,'#d5a649',Math.PI/2);
    for(let i=0;i<3;i++) body(0,.659-headDrop-i*.006,.14+i*.03,.018,.022,.018,'#a83b32');
    body(0,.513-headDrop,.242,.018,.026,.02,'#a83b32');
    for(let i=-1;i<=1;i++) body(i*.035,.39,-.235,.023,.12,.06,'#4b3a2b',-.7,i*.14);
  } else {
    body(0,.22,-.035,.14,.18,.235);
    body(0,.245,-.16,.165,.17,.145,'#8f7a60');
    body(0,.315-headDrop,.15,.092,.105,.1,'#9b866d');
    body(0,.27-headDrop,.225,.085,.056,.08,'#c9b498');
    body(0,.292-headDrop,.301,.026,.018,.012,'#6d5144');
    for(const side of [-1,1]) {
      body(side*.078,.35-headDrop,.193,.014,.014,.008,'#221f19');
      const earTilt = -.1+pace*.04;
      body(side*.05,.49-headDrop,.12,.035,.18,.032,'#92785d',earTilt,side*.13);
      body(side*.05,.5-headDrop,.143,.018,.14,.01,'#c19a87',earTilt,side*.13);
      body(side*.11,.13,-.13,.08,.1,.1);
      body(side*.1,.045,.0+pace*.065,.047,.04,.12,'#b29a7c',-.1);
      link('limb',[side*.07,.23,.115],[side*.07,.05,.17-pace*.035],.024,'#9c8469');
      body(side*.07,.033,.198-pace*.035,.028,.023,.065,'#bcaa8e');
    }
    body(0,.25,-.265,.058,.06,.057,'#d9ccaf');
  }
}
