import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getLookupKey, sha256Fallback } from '../spectrum/phone-hash.mjs';

test('HTTP fallback agrees with SHA-256 for known vectors and 300 synthetic guest numbers', async () => {
  const messages = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), '가나다',
    ...Array.from({ length: 300 }, (_, i) => '010' + String(i).padStart(8, '0'))];
  for (const message of messages) {
    const expected = createHash('sha256').update(message).digest('hex');
    assert.equal(sha256Fallback(message), expected);
    assert.equal(await getLookupKey(message), expected);
  }
});
