// Read private input in memory and never log guest values.
const { chromium } = require('../private/qa/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = process.env.SPECTRUM_URL || 'http://127.0.0.1:4175/spectrum/';

(async () => {
  const examples = JSON.parse(execFileSync('python3', ['-c', `
import json
from pathlib import Path
from scripts.prepare_spectrum_roster import read_rows
examples = {}
for number, row in read_rows(next(Path('private/rosters').glob('*.xlsx'))):
    if number == 1 or not row.get('C'): continue
    seat = row['B'].replace('_','-')
    group = seat[0].upper()
    if group not in examples: examples[group] = {'phone': row['C'], 'seat': seat, 'name': row.get('A','')}
guests = list(examples.values())
for guest in json.loads(Path('private/rosters/vip-guests.json').read_text()):
    guests.append({**guest, 'seat':'VIP'})
print(json.dumps(guests))
  `], { cwd:root, encoding:'utf8' }));
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const page = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    for (const example of examples) {
      await page.goto(base);
      await page.getByRole('button', {name:'티켓 열기'}).click();
      await page.locator('#phone').fill(example.phone);
      await page.locator('#lookup-button').click();
      await page.locator('#ticket-result').waitFor({ state:'visible' });
      assert.equal(await page.locator('#ticket-dialog').isVisible(), true);
      assert.equal(await page.locator('#about').isVisible(), true);
      if (/^v/i.test(example.seat)) {
        assert.equal(await page.locator('#ticket-seat-map .seat-active').count(), 0);
        assert.equal(await page.locator('#ticket-seat-map .zone-first-come').count(), 2);
      } else {
        assert.equal(await page.locator('#ticket-seat-map .seat-active').count(), 1);
        assert.equal(await page.locator('#ticket-seat-map .seat-active').getAttribute('data-seat'), example.seat);
      }
      if (example.name) assert.equal(await page.locator('#seat-summary .guest-name').textContent(), example.name);
      assert.equal(await page.locator('#page-seat-summary').textContent(), await page.locator('#seat-summary').textContent());
      assert.equal(await page.locator('#phone').inputValue(), '');
      assert.equal(await page.locator('#seat-summary button').count(), 0);
    }
    console.log('PASS: Actual XLSX phone lookup → exact chair for A–F, first-come VIP, matching guest names, no repeated confirmation.');
  } finally { await browser.close(); }
})().catch(error => { console.error('FAIL:', error.name, error.stack?.match(/real-roster\.browser\.cjs:\d+:\d+/)?.[0], 'Guest values suppressed.'); process.exitCode = 1; });
