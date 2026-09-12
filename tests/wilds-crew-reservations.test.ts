import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveWildsCrewLots,releaseWildsCrewReservations,reconcileWildsCrewReservations} from '../src/features/play/wilds-crew-reservations';
test('concurrent crew allocations reserve whole requests without taking another job’s lot',()=>{
 const first=reserveWildsCrewLots({}, {jobId:'builder1',workerId:'a',lotIds:['stone1','stone2']});assert.ok(first.ok);
 const conflict=reserveWildsCrewLots(first.reservations,{jobId:'builder2',workerId:'b',lotIds:['stone3','stone2']});
 assert.equal(conflict.ok,false);assert.equal(conflict.reservations,first.reservations);assert.equal(conflict.reservations.stone3,undefined);
 const retried=reserveWildsCrewLots(first.reservations,{jobId:'builder1',workerId:'a',lotIds:['stone1','stone2']});assert.ok(retried.ok);
 assert.equal(reserveWildsCrewLots(first.reservations,{jobId:'builder1',workerId:'b',lotIds:['stone1']}).ok,false);
});
test('recall releases only its reservations and reconciliation removes consumed/expired claims',()=>{
 const reservations={a:{jobId:'one',workerId:'c1',lotId:'a'},b:{jobId:'two',workerId:'c2',lotId:'b'}};
 assert.deepEqual(Object.keys(releaseWildsCrewReservations(reservations,'one')),['b']);
 assert.deepEqual(reconcileWildsCrewReservations(reservations,new Set(['one','two']),new Set(['b'])),{b:reservations.b});
 assert.deepEqual(reconcileWildsCrewReservations(reservations,new Set(),new Set(['a','b'])),{});
});

test("treats prototype-shaped lot identifiers as ordinary own keys", () => {
  const result = reserveWildsCrewLots({}, {jobId:"job",workerId:"worker",lotIds:["__proto__", "constructor"]});
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.reservations, "__proto__"), true);
  const conflict = reserveWildsCrewLots(result.reservations, {jobId:"other",workerId:"other",lotIds:["__proto__"]});
  assert.equal(conflict.ok, false);
});
