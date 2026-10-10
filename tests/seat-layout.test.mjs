import test from 'node:test';
import assert from 'node:assert/strict';
import { seatLayout, normalizeSeat } from '../spectrum/seat-layout.mjs';

test('PDF page 17 defines 180 unique chairs with opposite front/back order across the stage', () => {
  const all = Object.values(seatLayout).flat(2);
  assert.equal(all.length, 180);
  assert.equal(new Set(all).size, 180);
  for (const zone of 'ABCDEF') {
    const rows = seatLayout[zone];
    assert.deepEqual(rows.map(row => row.length), [10,10,10]);
    const frontIndex = zone <= 'C' ? 2 : 0;
    const backIndex = zone <= 'C' ? 0 : 2;
    assert.deepEqual(rows[frontIndex], ['a-1','a-2','b-1','b-2','c-1','c-2','d-1','d-2','e-1','e-2'].map(id => `${zone}-${id}`));
    assert.deepEqual(rows[1], ['a-3','a-4','b-3','b-4','c-3','c-4','d-3','d-4','e-3','e-4'].map(id => `${zone}-${id}`));
    assert.deepEqual(rows[backIndex], ['f-1','f-2','f-3','f-4','f-5','g-1','g-2','g-3','g-4','g-5'].map(id => `${zone}-${id}`));
  }
});

test('only explicit PDF seat IDs are accepted, with no invented sequential numbering', () => {
  for (const seat of ['A구역 a-1', 'A-a1', 'A A 1', 'Aa1']) assert.equal(normalizeSeat(seat), 'A-a-1');
  for (const seat of ['A01','A-a-5','A-f-6','G-a-1','V01','A-a-1x']) assert.equal(normalizeSeat(seat), null);
  assert.equal(normalizeSeat('F-g5'), 'F-g-5');
  assert.equal(normalizeSeat('VIP'), 'VIP');
});
