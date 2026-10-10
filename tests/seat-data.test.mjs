import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, normalizePhone, summarizeSeats, formatPhoneInput } from '../spectrum/seat-data.mjs';

test('phone input accepts domestic and +82 formats without losing the leading zero', () => {
  assert.equal(normalizePhone('010-0000-0001'), '01000000001');
  assert.equal(normalizePhone('010 · 0000 · 0001'), '01000000001');
  assert.equal(normalizePhone('+82 10 0000 0001'), '01000000001');
  assert.equal(normalizePhone('1000000001'), null);
  assert.equal(normalizePhone('010a00000001'), null);
});
test('phone display groups partial input and pasted international numbers', () => {
  assert.equal(formatPhoneInput('0100'), '010 · 0');
  assert.equal(formatPhoneInput('01000000'), '010 · 0000 · 0');
  assert.equal(formatPhoneInput('01000000001'), '010 · 0000 · 0001');
  assert.equal(formatPhoneInput('+82 10 1234 5678'), '010 · 1234 · 5678');
  assert.equal(formatPhoneInput('010-1234-5678'), '010 · 1234 · 5678');
});
test('CSV supports BOM, quoted names, embedded commas and empty allocations', () => {
  const key = 'a'.repeat(64);
  const rows = parseCSV(`\uFEFFphone_hash,seat,name,vip\r\n${key},A01,"테스트, 동반",\r\n${key},,,\r\n`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '테스트, 동반');
  assert.throws(() => parseCSV('phone_hash,seat\n"unfinished'));
  assert.throws(() => parseCSV('phone,seat\n01000000001,A01'));
});
test('zones remain distinct from assigned seats and no unverified VIP location is guessed', () => {
  const result = summarizeSeats([{ seat:'V1' }, { seat:'B-a-1' }, { seat:'B-a-2' }, { seat:'V1' }, { seat:'V01' }]);
  assert.deepEqual(result.seats, ['V1','B-a-1','B-a-2','V01']);
  assert.deepEqual(result.zones, ['B','V1']);
  assert.deepEqual(result.firstCome, ['V1']);
  assert.deepEqual(result.assigned, ['B-a-1','B-a-2']);
});
test('VIP guests never receive an assigned chair, even if a provisional seat is present', () => {
  const result = summarizeSeats([{ seat:'A-a-1', vip:'vip' }]);
  assert.deepEqual(result.assigned, []);
  assert.deepEqual(result.firstCome, ['V1','V2']);
});
