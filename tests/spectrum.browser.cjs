// Optional browser QA: npm install --prefix private/qa --no-save playwright
const { chromium } = require('../private/qa/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.SPECTRUM_URL || 'http://127.0.0.1:4174/spectrum/';
const output = path.resolve(__dirname, '../previews/spectrum');
const results = [];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const exceptions = [];
    page.on('pageerror', error => exceptions.push(error.message));
    const posts = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
    await page.goto(base);
    await page.locator('#home').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, 'home.png') });
    await page.getByRole('button', { name: '행사정보 보기', exact: false }).click();
    assert.equal(await page.locator('#about').isVisible(), true);
    await page.screenshot({ path: path.join(output, 'about.png') });
    results.push('Home → event information without ticket');

    const order = ['about','directions','exhibition','designers','timeline','seats','notice'];
    for (const name of order) {
      assert.equal(await page.locator('#' + name).isVisible(), true);
      await page.screenshot({ path: path.join(output, name + '.png') });
      if (name === 'directions') {
        const heading = await page.locator('#directions [data-name="섹션 제목"]').boundingBox();
        const map = await page.locator('#directions [data-name="약도"]').boundingBox();
        assert.equal(map.x, 24);
        assert.ok(map.y >= heading.y + heading.height + 15, 'Map must not cover the directions heading');
      }
      if (name === 'designers') {
        assert.equal(await page.locator('#designers [data-name="슬롯"]').count(), 39);
        await page.locator('#designers [data-name="슬롯"]').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'designers-end.png') });
      }
      if (name === 'seats') await page.screenshot({ path: path.join(output, 'seats.png') });
      await page.locator('#' + name + ' [data-name="다음 페이지"]').click();
    }
    assert.equal(await page.locator('#home').isVisible(), true);
    results.push('All seven pages and all 39 designer slots reachable');

    await page.getByRole('button', { name:'티켓 열기' }).click();
    assert.equal(await page.locator('#phone').evaluate(input => input === document.activeElement), true);
    await page.locator('#phone').pressSequentially('01000000001');
    assert.equal(await page.locator('#phone').inputValue(), '010 · 0000 · 0001');
    await page.locator('#phone').fill('01012345678');
    await page.locator('#phone').press('Home');
    for (let i = 0; i < 6; i++) await page.locator('#phone').press('ArrowRight');
    await page.locator('#phone').press('Backspace');
    assert.equal(await page.locator('#phone').inputValue(), '011 · 2345 · 678');
    await page.locator('#phone').press('0');
    assert.equal(await page.locator('#phone').inputValue(), '010 · 1234 · 5678');
    await page.locator('#phone').press('Home');
    for (let i = 0; i < 3; i++) await page.locator('#phone').press('ArrowRight');
    await page.locator('#phone').press('Delete');
    assert.equal(await page.locator('#phone').inputValue(), '010 · 2345 · 678');
    await page.locator('#phone').press('1');
    assert.equal(await page.locator('#phone').inputValue(), '010 · 1234 · 5678');
    await page.locator('#phone').fill('+82 10 0000 0001');
    assert.equal(await page.locator('#phone').inputValue(), '010 · 0000 · 0001');
    await page.screenshot({ path:path.join(output,'phone-format.png') });
    await page.locator('#seat-form [data-close]').click();
    assert.equal(await page.locator('#home').isVisible(), true, 'Cancel keeps the invitation home');
    results.push('Automatic dot spacing, input focus, paste and editing across separators');

    async function lookup(number) {
      await page.goto(base + '#home');
      await page.getByRole('button', { name: '티켓 열기' }).click();
      await page.locator('#phone').fill(number);
      await page.locator('#lookup-button').click();
    }
    await lookup('123');
    await page.locator('#lookup-message[data-state="error"]').waitFor();
    await page.locator('#phone').fill('01000000099');
    await page.locator('#lookup-button').click();
    await page.getByText('등록된 좌석이 없습니다.', { exact: false }).waitFor();
    assert.equal(await page.locator('#home').isVisible(), true, 'Failed lookup must not advance');
    await page.screenshot({ path: path.join(output, 'ticket-error.png') });
    results.push('Invalid and unknown numbers rejected');
    for (const [phone,seat,expected] of [
      ['01000000001','A-a-1',['A-a-1']],
      ['01000000002','V1',[]],
      ['01000000004','V2',[]],
      ['01000000003','B-a-1 · B-a-2 · B-a-3',['B-a-1','B-a-2','B-a-3']],
    ]) {
      await lookup(phone);
      await page.locator('#seat-summary').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#seat-summary .guest-location').textContent(), /^V[12]$/.test(seat) ? `VIP · ${seat} · 선착순` : seat.replaceAll(' · ', ' / '));
      assert.equal(await page.locator('#seat-summary .guest-name').textContent(), '테스트 관객 박상민');
      assert.equal(await page.locator('#seat-summary').getAttribute('class'), 'guest-result');
      assert.equal(await page.locator('#seat-summary button').count(), 0);
      assert.equal(await page.locator('#ticket-dialog').isVisible(), true);
      assert.equal(await page.locator('#seat-form').isVisible(), false);
      assert.equal(new URL(page.url()).hash, '#about');
      assert.deepEqual(await page.locator('#seat-map').evaluate(map => [...map.querySelectorAll('.seat-active')].map(chair => chair.dataset.seat).sort()), [...expected].sort());
      assert.equal(await page.locator('#page-seat-summary').textContent(), await page.locator('#seat-summary').textContent());
      const selected = await page.locator('#ticket-seat-map').evaluate(map => [...map.querySelectorAll('.seat-active')].map(chair => chair.dataset.seat));
      assert.deepEqual(selected.sort(), expected.sort());
      assert.equal(await page.locator('#ticket-seat-map [data-seat]').count(), 180);
      assert.equal(await page.locator('.seat-marker').count(), 0);
      assert.equal(await page.locator('#ticket-seat-map [data-zone="A"].highlight, #ticket-seat-map [data-zone="B"].highlight').count(), 0);
      if (seat === 'V1' || seat === 'V2') {
        assert.equal(await page.locator(`#ticket-seat-map [data-zone="${seat}"].zone-first-come`).count(), 1);
        await page.screenshot({ path: path.join(output, 'vip-seat.png') });
      }
      if (expected.length === 1) await page.screenshot({ path: path.join(output, 'assigned-seat.png') });
      if (expected.length === 3) await page.screenshot({ path: path.join(output, 'companion-seats.png') });
    }
    await page.locator('#ticket-result [data-close]').click();
    async function navigateTo(name) {
      await page.getByRole('button', {name:'메뉴 열기'}).filter({visible:true}).click();
      await page.locator(`#menu-dialog [data-go="${name}"]`).click();
    }
    async function reopenTicket(number) {
      await page.getByRole('button', {name:'메뉴 열기'}).filter({visible:true}).click();
      await page.locator('#menu-dialog [data-ticket]').click();
      await page.locator('#phone').fill(number);
      await page.locator('#lookup-button').click();
    }
    assert.equal(await page.locator('#about').isVisible(), true);
    await navigateTo('seats');
    await page.locator('#page-seat-summary').waitFor({state:'visible'});
    assert.equal(await page.locator('#seat-map .seat-active').count(), 3);
    await navigateTo('about');
    await navigateTo('seats');
    assert.equal(await page.locator('#seat-map .seat-active').count(), 3);
    // Failed or cancelled input must not erase the last confirmed seat.
    await reopenTicket('01000000099');
    await page.locator('#lookup-message[data-state="error"]').waitFor();
    await page.locator('#seat-form [data-close]').click();
    assert.equal(await page.locator('#seat-map .seat-active').count(), 3);
    for (const [number, chairs, vip] of [['01000000002',0,1], ['01000000001',1,0]]) {
      await reopenTicket(number);
      await page.locator('#ticket-result').waitFor({state:'visible'});
      assert.equal(new URL(page.url()).hash, '#seats');
      for (const map of ['#seat-map', '#ticket-seat-map']) {
        assert.equal(await page.locator(`${map} .seat-active`).count(), chairs);
        assert.equal(await page.locator(`${map} .zone-first-come`).count(), vip);
      }
      await page.locator('#ticket-result [data-close]').click();
      assert.equal(await page.locator('#page-seat-summary').isVisible(), true);
    }
    await page.screenshot({path:path.join(output,'seats-retained.png')});
    results.push('Page 06 retains lookup across navigation and failed input; new assigned/VIP results replace both maps');
    // Verify distant chairs across both sides of the stage, including f/g fifth seats.
    const testHash = require('node:crypto').createHash('sha256').update('01000000006').digest('hex');
    const allocations = ['A-f-1','B-g-5','C-a-2','D-a-1','E-e-4','F-g-5'];
    await page.route('**/spectrum/seats.csv', route => route.fulfill({
      status: 200, body: 'phone_hash,seat\n' + allocations.map(seat => `${testHash},${seat}`).join('\n'),
    }));
    await lookup('01000000006');
    await page.locator('#seat-summary').waitFor({ state: 'visible' });
    for (const width of [320,390,430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.deepEqual((await page.locator('#ticket-seat-map').evaluate(map => [...map.querySelectorAll('.seat-active')].map(chair => chair.dataset.seat))).sort(), [...allocations].sort());
      // PDF: A-a-1 is closer to the stage (below A-f-1); D-a-1 is above D-f-1.
      const boxes = await page.locator('#ticket-seat-map').evaluate(map => Object.fromEntries(['A-a-1','A-f-1','D-a-1','D-f-1'].map(id => [id, map.querySelector(`[data-seat="${id}"]`).getBoundingClientRect().y])));
      assert.ok(boxes['A-a-1'] > boxes['A-f-1']);
      assert.ok(boxes['D-a-1'] < boxes['D-f-1']);
    }
    await page.screenshot({ path: path.join(output, 'pdf-mapped-seats.png') });
    await page.unroute('**/spectrum/seats.csv');
    await page.locator('#ticket-result [data-close]').click();
    assert.equal(await page.locator('#ticket-dialog').isVisible(), false);
    assert.equal(await page.locator('#about').isVisible(), true);
    assert.equal(new URL(page.url()).hash, '#about');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#about h1'));
    results.push('Successful home lookup keeps the ticket result open, then dismisses into show introduction with focus restored');
    await page.route('**/spectrum/seats.csv', route => route.fulfill({
      status:200, body:`phone_hash,seat,name,vip\n${testHash},VIP,테스트 관객 박상민,vip\n`,
    }));
    await lookup('01000000006');
    await page.locator('#seat-summary').waitFor({state:'visible'});
    assert.equal(await page.locator('#ticket-seat-map .zone-first-come').count(), 2);
    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      const clipped = await page.locator('#ticket-seat-map').evaluate(map => {
        const clipped = [];
        const scale = map.getBoundingClientRect().width / map.offsetWidth;
        for (const zone of map.querySelectorAll('.zone-first-come')) {
          const rect = zone.getBoundingClientRect();
          const padding = 6 * scale; // Rotated 1px outline + 3px offset.
          for (let parent = zone.parentElement; parent && parent !== map.parentElement; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clipX = style.overflowX !== 'visible';
            const clipY = style.overflowY !== 'visible';
            const bounds = parent.getBoundingClientRect();
            if ((clipX && (rect.left-padding < bounds.left || rect.right+padding > bounds.right)) ||
                (clipY && (rect.top-padding < bounds.top || rect.bottom+padding > bounds.bottom))) {
              clipped.push({zone:zone.dataset.zone,parent:parent.dataset.name || parent.className});
            }
          }
        }
        return clipped;
      });
      assert.deepEqual(clipped, [], `${width}px VIP outlines must not be clipped`);
      if (width === 390) await page.screenshot({path:path.join(output,'vip-both.png')});
    }
    await page.unroute('**/spectrum/seats.csv');
    results.push('Both rotated VIP outlines remain complete at 320/390/430px');
    await page.reload();
    assert.equal(await page.locator('#seat-summary').isVisible(), false);
    assert.equal(await page.locator('.seat-active').count(), 0);
    assert.equal(await page.locator('#page-seat-summary').isVisible(), false);
    results.push('Guest lookup cleared on reload');
    await page.goto(base + '#about');
    await page.getByRole('button', {name:'메뉴 열기'}).filter({visible:true}).click();
    await page.locator('#menu-dialog [data-ticket]').click();
    await page.locator('#phone').fill('01000000001');
    await page.locator('#lookup-button').click();
    await page.locator('#ticket-result').waitFor({state:'visible'});
    assert.equal(new URL(page.url()).hash, '#about');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#about').isVisible(), true);
    assert.equal(await page.locator('#ticket-dialog').isVisible(), false);
    results.push('Lookup from an information page preserves that page and dismisses with Escape');

    for (const [width,height] of [[320,568],[360,640],[390,844],[430,932],[844,390],[1280,844]]) {
      await page.setViewportSize({ width, height });
      for (const name of ['home', ...order]) {
        await page.goto(base + '#' + name);
        await page.locator('#' + name).waitFor({ state: 'visible' });
        const geometry = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          images: [...document.images].filter(img => img.getClientRects().length && (!img.complete || !img.naturalWidth)).map(img => img.src),
          escaped: [...document.querySelectorAll('.page:not([hidden]) img')].filter(img => {
            const r = img.getBoundingClientRect();
            return r.width && (r.width > 500 || r.height > 500);
          }).map(img => img.src),
        }));
        assert.equal(geometry.overflow, false, `${width} ${name} overflows`);
        assert.deepEqual(geometry.images, [], `${width} ${name} broken images`);
        assert.deepEqual(geometry.escaped, [], `${width} ${name} image geometry`);
        const frame = await page.locator('#main').boundingBox();
        assert.equal(frame.width, Math.min(width,390), 'Use the same mobile width on every device');
        if (name !== 'home') {
          const footer = await page.locator('#' + name + ' .page-footer').boundingBox();
          assert.ok(footer.y + footer.height <= height + 1, `${width}×${height} ${name} footer must remain in the viewport`);
        }
      }
      if (width === 320) {
        await page.goto(base + '#home');
        await page.screenshot({path:path.join(output,'mobile-320-home.png')});
        await page.getByRole('button',{name:'티켓 열기'}).click();
        await page.locator('#phone').fill('01000000001');
        await page.locator('#lookup-button').click();
        await page.locator('#seat-summary').waitFor({state:'visible'});
        await page.waitForFunction(() => {
          const marker = document.querySelector('#ticket-seat-map .seat-active').getBoundingClientRect();
          const content = document.querySelector('#ticket-dialog').getBoundingClientRect();
          return marker.y >= content.y && marker.bottom <= content.bottom;
        });
        await page.screenshot({path:path.join(output,'mobile-320-seat.png')});
      }
    }
    results.push('Mobile touch at 320×568, 360×640, 390×844, 430×932 and landscape; same 390px layout on PC; visible footers');
    await page.setViewportSize({ width:390, height:844 });
    await page.goto(base + '#about');
    await page.getByRole('button', { name:'메뉴 열기' }).filter({ visible:true }).click();
    await page.locator('#menu-dialog [data-go="seats"]').click();
    assert.equal(await page.locator('#seats').isVisible(), true);
    await page.getByRole('button', { name:'메뉴 열기' }).filter({ visible:true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu-dialog').isVisible(), false);
    results.push('Menu navigation and Escape dismissal');
    await page.goto(base + '#directions');
    assert.match(await page.getByRole('link', { name:'네이버 지도에서 보기' }).getAttribute('href'), /map\.naver\.com/);

    // A late response must not reveal the previous lookup after the number changes.
    await page.route('**/spectrum/seats.csv', async route => {
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.continue();
    });
    await lookup('01000000001');
    await page.locator('#phone').fill('01000000099');
    await page.locator('#lookup-button').click();
    await page.getByText('등록된 좌석이 없습니다.', { exact:false }).waitFor();
    assert.equal(await page.locator('#seat-summary').isVisible(), false);
    await page.unroute('**/spectrum/seats.csv');
    await page.route('**/spectrum/seats.csv', route => route.fulfill({ status:503, body:'Unavailable' }));
    await lookup('01000000001');
    await page.getByText('명단을 불러오지 못했습니다.', { exact:false }).waitFor();
    results.push('Late lookup response ignored; roster failures explained');
    assert.deepEqual(exceptions, []);
    assert.deepEqual(posts, [], 'Static lookup must not contact an API');
    results.push('No JavaScript runtime exceptions');
    await fs.writeFile(path.join(output,'verification.json'), JSON.stringify({status:'PASS',results},null,2));
    console.log(JSON.stringify({status:'PASS',results},null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
