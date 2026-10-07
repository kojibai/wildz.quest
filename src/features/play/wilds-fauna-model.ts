import type { WildsAnimalSpecies } from './wilds-animal-ecology';
import type { WildsFaunaLifePose } from './wilds-fauna-motion';
export type WildsFaunaPart = 'body' | 'limb' | 'tip';
export type WildsFaunaDraw = (shape: WildsFaunaPart, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, tilt?: number, roll?: number, yaw?: number) => void;

/** Local anatomy faces +Z. One shared instanced batch per shape, with articulated joints. */
export function drawWildsFauna(species: WildsAnimalSpecies, gait: number, moving: boolean, grazing: boolean, draw: WildsFaunaDraw, life?: WildsFaunaLifePose) {
  const goat = species === 'meadow-goat', bird = species === 'ground-bird';
  const activity = life?.locomotion ?? (moving ? 1 : 0), pace = Math.sin(gait) * activity;
  const hop = !goat && !bird ? Math.max(0, Math.sin(gait)) * .07 * activity : 0;
  const size = life?.size ?? 1, variant = Math.min(2, Math.floor((life?.variant ?? 0) * 3));
  const coat = (goat ? ['#b5a58a','#dfd1b7','#a5815d'] : bird ? ['#aa7845','#bd955e','#966c49'] : ['#87735b','#a89475','#9c8161'])[variant]!;
  const part: WildsFaunaDraw = (shape, x, y, z, sx, sy, sz, tone, tilt=0, roll=0, yaw=0) => draw(shape,x*size,y*size,z*size,sx*size,sy*size,sz*size,tone,tilt,roll,yaw);
  const body = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone = coat, tilt = 0, roll = 0, yaw=0) => part('body', x, y + hop, z, sx, sy, sz, tone, tilt, roll, yaw);
  const expansion = 1 + (life?.breath ?? 0) * .025;
  const torso = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tone=coat) => body(x,y,z,sx*expansion,sy*(1+(life?.breath??0)*.012),sz,tone);
  const headDrop = life ? life.forage * (goat ? .3 : bird ? .25 : .12) : grazing ? (goat ? .27 : .13) : 0;
  const headYaw = life?.headYaw ?? 0, headPitch = (life?.headPitch ?? 0) + (life?.forage ?? 0) * (goat ? .65 : .25);
  const pivotY = (goat ? .81 : bird ? .45 : .28) - headDrop, pivotZ = goat ? .28 : bird ? .14 : .13;
  const headPoint = (x:number,y:number,z:number):[number,number,number] => {
    const dy=y-pivotY,dz=z-pivotZ,forward=dy*Math.sin(headPitch)+dz*Math.cos(headPitch);
    return [x*Math.cos(headYaw)+forward*Math.sin(headYaw),pivotY+dy*Math.cos(headPitch)-dz*Math.sin(headPitch),pivotZ+forward*Math.cos(headYaw)-x*Math.sin(headYaw)];
  };
  const head = (x:number,y:number,z:number,sx:number,sy:number,sz:number,tone=coat,tilt=0,roll=0) => {
    const p=headPoint(x,y,z);body(...p,sx,sy,sz,tone,tilt+headPitch,roll,headYaw);
  };
  const eyeOpen = Math.max(.08, 1 - (life?.blink ?? 0));
  const foot = (phase: number, length: number) => {
    const stepping=life?.footActivity??activity;
    if(!stepping)return {z:0,lift:0};
    if (!life) return { z:Math.sin(phase)*length*.5*stepping, lift:Math.max(0,Math.sin(phase))*.075*stepping };
    const at=((phase/(Math.PI*2))%1+1)%1, swing=at>.62, travel=swing?(at-.62)/.38:at/.62;
    const eased=travel*travel*(3-2*travel);
    return {z:(swing?-.5+eased:.5-travel)*length*stepping,lift:swing?Math.sin(travel*Math.PI)*.075*stepping:0};
  };
  const link = (shape: 'limb' | 'tip', a: [number, number, number], b: [number, number, number], width: number, tone: string) => {
    const dy = b[1] - a[1], dz = b[2] - a[2], dx = b[0] - a[0];
    part(shape, (a[0]+b[0])/2, (a[1]+b[1])/2+hop, (a[2]+b[2])/2,
      width, Math.hypot(dx,dy,dz), width, tone, Math.atan2(dz,dy), -Math.atan2(dx,Math.hypot(dy,dz)));
  };
  if (goat) {
    torso(0,.67,0,.23,.27,.46); // rib cage, shoulder, rump, belly
    body(0,.73,-.29,.24,.26,.25,'#a4957b');
    body(0,.77,.27,.19,.26,.23,'#b9aa90');
    body(0,.57,.02,.18,.14,.35,'#d0c2a7');
    head(0,.86-headDrop,.43,.12,.24,.14,'#cbbda1',-.4);
    head(0,1.04-headDrop,.52,.11,.16,.15,'#c7b89b',-.25);
    head(0,.98-headDrop+(life?.chew??0)*.007,.65,.105,.085,.14,'#d6c6a8'); // muzzle, dark nose and beard
    head(0,.96-headDrop,.765,.075,.05,.018,'#403a30');
    const beard=headPoint(0,.84-headDrop,.66);part('tip',...beard,.045,.14,.045,'#b6a58c',Math.PI+headPitch,0,headYaw);
    for (const side of [-1,1]) {
      head(side*.1,1.065-headDrop,.59,.022,.019*eyeOpen,.013,'#2f291f');
      head(side*.105,1.066-headDrop,.602,.014,.009*eyeOpen,.006,'#bfa057');
      head(side*.18,1.09-headDrop,.49,.12,.036,.055,'#b9a78e',.15+(life?.ear??0)*side,side*.28);
      head(side*.187,1.096-headDrop,.505,.072,.014,.035,'#9d7964',.15+(life?.ear??0)*side,side*.28);
      link('limb',headPoint(side*.07,1.15-headDrop,.47),headPoint(side*.085,1.29-headDrop,.39),.035,'#807459');
      link('tip',headPoint(side*.085,1.29-headDrop,.39),headPoint(side*.075,1.38-headDrop,.3),.028,'#6a6250');
      for (const front of [-1,1]) {
        const step=foot(gait+(side<0?Math.PI:0)+(front<0?Math.PI*.5:0),life?.stride??.3);
        const z = front*.28, kneeZ=z+step.z*.65, footZ=z+step.z, lift=step.lift,kneeY=.32+lift*.5;
        link('limb',[side*.16,.67,z],[side*.17,kneeY,kneeZ],.045,coat);
        body(side*.17,kneeY,kneeZ,.042,.05,.045,'#b1a084');
        link('limb',[side*.17,kneeY,kneeZ],[side*.17,.075+lift,footZ],.028,'#b9a98d');
        body(side*.17,.055+lift,footZ+.012,.044,.055,.065,'#514b40');
      }
    }
    link('limb',[0,.84,-.42],[life?.tail??0,.96,-.53],.032,'#a18c70');
    body(life?.tail??0,.96,-.53,.035,.07,.045);
  } else if (bird) {
    const bob = Math.abs(pace)*.012;
    torso(0,.3+bob,0,.145,.19,.23);
    body(0,.25+bob,.1,.13,.12,.14,'#d4b187');
    head(0,.47-headDrop,.16,.066,.135,.07,'#c0a581',-.2);
    head(0,.58-headDrop,.19,.078,.085,.09,'#c9b397');
    for (const side of [-1,1]) {
      body(side*.135,.32,-.02,.047,.12,.18,'#755033',-.15,side*.12);
      for (let feather=0;feather<3;feather++) body(side*(.14+feather*.012),.25+feather*.026,-.1,.012,.07,.115,'#8d6743',-.28);
      head(side*.07,.604-headDrop,.223,.012,.013*eyeOpen,.007,'#24211a');
      const step=foot(gait+(side<0?Math.PI:0),life?.stride??.12);
      const knee:[number,number,number]=[side*.045,.13+step.lift*.45,-.012+step.z*.45];
      link('limb',[side*.045,.21,.03],knee,.013,'#c79345');
      link('limb',knee,[side*.045,.04+step.lift,.03+step.z],.01,'#c79345');
      for (const toe of [-1,0,1]) link('limb',[side*.045,.04+step.lift,.03+step.z],[side*.045+toe*.021,.022+step.lift,.1+step.z],.006,'#b9863b');
    }
    const beak=headPoint(0,.565-headDrop,.292);part('tip',...beak,.028,.072,.03,'#d5a649',Math.PI/2+headPitch,0,headYaw);
    for(let i=0;i<3;i++) head(0,.659-headDrop-i*.006,.14+i*.03,.018,.022,.018,'#a83b32');
    head(0,.513-headDrop+(life?.chew??0)*.006,.242,.018,.026,.02,'#a83b32');
    for(let i=-1;i<=1;i++) body(i*.035,.39,-.235,.023,.12,.06,'#4b3a2b',-.7+(life?.tail??0)*.3,i*.14);
  } else {
    torso(0,.22,-.035,.14,.18,.235);
    body(0,.245,-.16,.165,.17,.145,'#8f7a60');
    head(0,.315-headDrop,.15,.092,.105,.1,'#9b866d');
    head(0,.27-headDrop+(life?.chew??0)*.006,.225,.085,.056,.08,'#c9b498');
    head(0,.292-headDrop,.301,.026,.018,.012,'#6d5144');
    for(const side of [-1,1]) {
      head(side*.078,.35-headDrop,.193,.014,.014*eyeOpen,.008,'#221f19');
      const earTilt = -.1+pace*.04+(life?.ear??0)*side;
      head(side*.05,.49-headDrop,.12,.035,.18,.032,'#92785d',earTilt,side*.13);
      head(side*.05,.5-headDrop,.143,.018,.14,.01,'#c19a87',earTilt,side*.13);
      body(side*.11,.13,-.13,.08,.1,.1);
      const rear=foot(gait+Math.PI,life?.stride??.3),front=foot(gait,life?.stride??.3);
      const hock:[number,number,number]=[side*.1,.095+rear.lift*.5,-.08+rear.z*.45];
      link('limb',[side*.11,.16,-.13],hock,.035,'#9c8469');
      link('limb',hock,[side*.1,.045+rear.lift,rear.z],.025,'#9c8469');
      body(side*.1,.045+rear.lift,rear.z,.047,.04,.12,'#b29a7c',-.1);
      const elbow:[number,number,number]=[side*.07,.14+front.lift*.4,.12+front.z*.45];
      link('limb',[side*.07,.23,.115],elbow,.024,'#9c8469');
      link('limb',elbow,[side*.07,.05+front.lift,.17+front.z],.018,'#9c8469');
      body(side*.07,.033+front.lift,.198+front.z,.028,.023,.065,'#bcaa8e');
    }
    body((life?.tail??0)*.12,.25,-.265,.058,.06,.057,'#d9ccaf');
  }
}
